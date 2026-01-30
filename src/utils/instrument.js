/**
 * Instruments JavaScript for line-by-line stepping: every statement (including
 * inside if/else, loops) gets await __step(line) before it. We build a new AST
 * recursively instead of mutating during traverse to avoid crashes.
 */
import * as parser from '@babel/parser'
import generate from '@babel/generator'
import * as t from '@babel/types'

const STEP_VAR = '__step'
const SCOPE_VAR = '__scope'

function getLine(node) {
  return node.loc ? node.loc.start.line : 1
}

function stepCall(line) {
  return t.expressionStatement(
    t.awaitExpression(
      t.callExpression(t.identifier(STEP_VAR), [t.numericLiteral(line)])
    )
  )
}

function getAssignedNames(node) {
  const names = []
  if (t.isVariableDeclaration(node)) {
    node.declarations.forEach((decl) => {
      if (t.isIdentifier(decl.id)) names.push(decl.id.name)
      else if (t.isObjectPattern(decl.id))
        decl.id.properties.forEach((p) => {
          if (t.isIdentifier(p.value)) names.push(p.value.name)
        })
      else if (t.isArrayPattern(decl.id))
        decl.id.elements.forEach((el) => {
          if (t.isIdentifier(el)) names.push(el.name)
        })
    })
    return names
  }
  if (t.isAssignmentExpression(node) && t.isIdentifier(node.left)) {
    names.push(node.left.name)
    return names
  }
  /* ExpressionStatement s priradením (text = "abc";) – treba zapisovať do __scope */
  if (t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression) && t.isIdentifier(node.expression.left)) {
    names.push(node.expression.left.name)
    return names
  }
  if (t.isExpressionStatement(node) && t.isUpdateExpression(node.expression) && t.isIdentifier(node.expression.argument)) {
    names.push(node.expression.argument.name)
    return names
  }
  return names
}

/** Premenné menené v update výraze (i++, ++i, i += 1, …) */
function getUpdatedNames(expr) {
  if (!expr) return []
  if (t.isUpdateExpression(expr) && t.isIdentifier(expr.argument)) {
    return [expr.argument.name]
  }
  if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left)) {
    return [expr.left.name]
  }
  return []
}

function scopeUpdates(names) {
  return names.map((name) =>
    t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          t.identifier(SCOPE_VAR),
          t.identifier(name),
          false
        ),
        t.identifier(name)
      )
    )
  )
}

function flatten(arr) {
  return arr.reduce((acc, x) => acc.concat(Array.isArray(x) ? x : [x]), [])
}

/**
 * Process a block body: instrument every statement inside.
 * @param {import('@babel/types').BlockStatement} block
 * @returns {import('@babel/types').BlockStatement}
 */
function processBlock(block) {
  if (!t.isBlockStatement(block)) return block
  const newBody = flatten(block.body.map((stmt) => processStatement(stmt)))
  return t.blockStatement(newBody)
}

/**
 * Process a single statement that might be used as loop/if body (can be one stmt or block).
 * Returns a BlockStatement with instrumented content.
 */
function processBody(stmt) {
  if (t.isBlockStatement(stmt)) return processBlock(stmt)
  const nodes = processStatement(stmt)
  return t.blockStatement(nodes)
}

/**
 * Process one statement: returns array of nodes [stepCall, maybeModifiedNode, ...scopeUpdates].
 */
function processStatement(node) {
  const line = getLine(node)
  const step = stepCall(line)
  const names = getAssignedNames(node)
  const updates = scopeUpdates(names)

  if (t.isIfStatement(node)) {
    const consequent = processBlock(node.consequent)
    const alternate = node.alternate
      ? t.isBlockStatement(node.alternate)
        ? processBlock(node.alternate)
        : t.blockStatement(processStatement(node.alternate))
      : null
    return [step, t.ifStatement(node.test, consequent, alternate), ...updates]
  }

  if (t.isForStatement(node)) {
    // Tok: 1 krok na riadok for (podmienka) → 1 krok na riadok tela (prvý príkaz v { }) → update → späť na for
    const forLine = getLine(node)
    const bodyLine = t.isBlockStatement(node.body) && node.body.body.length > 0
      ? getLine(node.body.body[0])
      : getLine(node.body)
    const updateLine = node.update ? getLine(node.update) : forLine
    const stepAtFor = stepCall(forLine)
    const stepAtBody = stepCall(bodyLine)
    const stepAtUpdate = stepCall(updateLine)
    const rawBody = t.isBlockStatement(node.body)
      ? node.body
      : t.blockStatement([node.body])

    const whileBody = [
      stepAtFor,
      node.test
        ? t.ifStatement(
            t.unaryExpression('!', node.test),
            t.breakStatement()
          )
        : null,
      stepAtBody,
      rawBody,
      ...(node.update
        ? [
            stepAtUpdate,
            t.expressionStatement(node.update),
            ...scopeUpdates(getUpdatedNames(node.update)),
          ]
        : []),
    ].filter(Boolean)

    const whileLoop = t.whileStatement(
      t.booleanLiteral(true),
      t.blockStatement(whileBody)
    )

    const result = []
    let loopVarNames = []
    if (node.init) {
      const initStmt = t.isVariableDeclaration(node.init) || t.isExpressionStatement(node.init)
        ? node.init
        : t.expressionStatement(node.init)
      loopVarNames = getAssignedNames(initStmt)
      result.push(initStmt)
      result.push(...scopeUpdates(loopVarNames))
    }
    result.push(whileLoop)
    // let v for je block-scoped: po cykle premenná neexistuje – odstránime ju zo zobrazenia
    loopVarNames.forEach((name) => {
      result.push(
        t.expressionStatement(
          t.unaryExpression(
            'delete',
            t.memberExpression(t.identifier(SCOPE_VAR), t.identifier(name), false)
          )
        )
      )
    })
    return result
  }

  if (t.isWhileStatement(node)) {
    // Rovnako ako for: krok na riadok while (podmienka) → instrumentované telo (kroky + scope pre i++)
    const whileLine = getLine(node)
    const stepAtWhile = stepCall(whileLine)
    const instrumentedBody = processBody(node.body)
    const whileBody = [
      stepAtWhile,
      t.ifStatement(
        t.unaryExpression('!', node.test),
        t.breakStatement()
      ),
      ...instrumentedBody.body,
    ]
    const whileLoop = t.whileStatement(
      t.booleanLiteral(true),
      t.blockStatement(whileBody)
    )
    return [step, whileLoop, ...updates]
  }

  if (t.isDoWhileStatement(node)) {
    // do { body } while (test) → telo (už má kroky), krok na podmienku, overenie
    const conditionLine = getLine(node.test)
    const stepAtCondition = stepCall(conditionLine)
    const instrumentedBody = processBody(node.body)
    const whileBody = [
      ...instrumentedBody.body,
      stepAtCondition,
      t.ifStatement(
        t.unaryExpression('!', node.test),
        t.breakStatement()
      ),
    ]
    const whileLoop = t.whileStatement(
      t.booleanLiteral(true),
      t.blockStatement(whileBody)
    )
    return [step, whileLoop, ...updates]
  }

  if (t.isForInStatement(node)) {
    // for (x in obj) { body } → krok na for-in, telo (už má kroky pred každým príkazom)
    const forInLine = getLine(node)
    const stepAtForIn = stepCall(forInLine)
    const instrumentedBody = processBody(node.body)
    const newBody = t.blockStatement([
      stepAtForIn,
      ...instrumentedBody.body,
    ])
    return [step, t.forInStatement(node.left, node.right, newBody), ...updates]
  }

  if (t.isForOfStatement(node)) {
    // for (x of iterable) { body } → krok na for-of, telo (už má kroky pred každým príkazom)
    const forOfLine = getLine(node)
    const stepAtForOf = stepCall(forOfLine)
    const instrumentedBody = processBody(node.body)
    const newBody = t.blockStatement([
      stepAtForOf,
      ...instrumentedBody.body,
    ])
    return [step, t.forOfStatement(node.left, node.right, newBody), ...updates]
  }

  if (t.isSwitchStatement(node)) {
    const cases = node.cases.map((c) =>
      t.switchCase(
        c.test,
        flatten(c.consequent.map((stmt) => processStatement(stmt)))
      )
    )
    return [step, t.switchStatement(node.discriminant, cases), ...updates]
  }

  if (t.isTryStatement(node)) {
    const block = processBlock(node.block)
    const handler = node.handler
      ? t.catchClause(node.handler.param, processBlock(node.handler.body))
      : null
    const finalizer = node.finalizer ? processBlock(node.finalizer) : null
    return [step, t.tryStatement(block, handler, finalizer), ...updates]
  }

  if (t.isBlockStatement(node)) {
    const newBlock = processBlock(node)
    return [step, newBlock, ...updates]
  }

  return [step, node, ...updates]
}

export function instrumentJavaScript(source) {
  try {
    const ast = parser.parse(source, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
      plugins: ['topLevelAwait'],
    })

    const newBody = flatten(ast.program.body.map((stmt) => processStatement(stmt)))
    ast.program.body = newBody

    const out = generate(
      ast,
      { retainLines: true, compact: false },
      source
    )

    return { code: out.code, error: null }
  } catch (err) {
    return {
      code: '',
      error: err.message || 'Parse error',
    }
  }
}

export function wrapInstrumentedCode(instrumentedCode) {
  return `(async function(${STEP_VAR}, ${SCOPE_VAR}) {\n  ${instrumentedCode}\n})`
}
