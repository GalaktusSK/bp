import * as parser from '@babel/parser'
import generate from '@babel/generator'
import * as t from '@babel/types'
import traverse from '@babel/traverse'

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

function getMemberAssignmentRootIdentifiers(memberExpr) {
  if (!t.isMemberExpression(memberExpr)) return []
  let cur = memberExpr
  while (t.isMemberExpression(cur.object)) {
    cur = cur.object
  }
  if (t.isIdentifier(cur.object)) {
    return [cur.object.name]
  }
  return []
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
  if (t.isAssignmentExpression(node) && t.isMemberExpression(node.left)) {
    names.push(...getMemberAssignmentRootIdentifiers(node.left))
    return names
  }
  if (t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression)) {
    const left = node.expression.left
    if (t.isIdentifier(left)) {
      names.push(left.name)
      return names
    }
    if (t.isMemberExpression(left)) {
      names.push(...getMemberAssignmentRootIdentifiers(left))
      return names
    }
  }
  if (t.isExpressionStatement(node) && t.isUpdateExpression(node.expression) && t.isIdentifier(node.expression.argument)) {
    names.push(node.expression.argument.name)
    return names
  }
  if (
    t.isExpressionStatement(node) &&
    t.isCallExpression(node.expression) &&
    t.isIdentifier(node.expression.callee, { name: '__c_ptr_setChar' })
  ) {
    const target = node.expression.arguments[0]
    if (t.isIdentifier(target)) {
      names.push(target.name)
      return names
    }
    if (t.isMemberExpression(target) && t.isIdentifier(target.object)) {
      names.push(target.object.name)
      return names
    }
  }
  return names
}

function getUpdatedNames(expr) {
  if (!expr) return []
  if (t.isUpdateExpression(expr) && t.isIdentifier(expr.argument)) {
    return [expr.argument.name]
  }
  if (t.isAssignmentExpression(expr) && t.isIdentifier(expr.left)) {
    return [expr.left.name]
  }
  if (t.isAssignmentExpression(expr) && t.isMemberExpression(expr.left)) {
    return getMemberAssignmentRootIdentifiers(expr.left)
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

function asyncifyFunctionsAndCalls(ast) {
  const functionNames = new Set()

  traverse(ast, {
    FunctionDeclaration(path) {
      if (!path.node.id?.name) return
      if (path.node.id.name.startsWith('__c_')) return
      functionNames.add(path.node.id.name)
    },
  })

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name?.startsWith('__c_')) return
      path.node.async = true
    },
  })

  traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) return
      if (!functionNames.has(path.node.callee.name)) return
      if (t.isAwaitExpression(path.parent)) return
      path.replaceWith(t.awaitExpression(path.node))
      path.skip()
    },
  })
}

function processBlock(block) {
  if (!t.isBlockStatement(block)) return block
  const newBody = flatten(block.body.map((stmt) => processStatement(stmt)))
  return t.blockStatement(newBody)
}

function processBody(stmt) {
  if (t.isBlockStatement(stmt)) return processBlock(stmt)
  const nodes = processStatement(stmt)
  return t.blockStatement(nodes)
}

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
    const forLine = getLine(node)
    const updateLine = node.update ? getLine(node.update) : forLine
    const stepAtFor = stepCall(forLine)
    const stepAtUpdate = stepCall(updateLine)
    const instrumentedBody = processBody(node.body)

    const whileBody = [
      stepAtFor,
      node.test
        ? t.ifStatement(
            t.unaryExpression('!', node.test),
            t.breakStatement()
          )
        : null,
      ...instrumentedBody.body,
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

    const inner = []
    let loopVarNames = []
    if (node.init) {
      const initStmt = t.isVariableDeclaration(node.init) || t.isExpressionStatement(node.init)
        ? node.init
        : t.expressionStatement(node.init)
      loopVarNames = getAssignedNames(initStmt)
      inner.push(initStmt)
      inner.push(...scopeUpdates(loopVarNames))
    }
    inner.push(whileLoop)
    loopVarNames.forEach((name) => {
      inner.push(
        t.expressionStatement(
          t.unaryExpression(
            'delete',
            t.memberExpression(t.identifier(SCOPE_VAR), t.identifier(name), false)
          )
        )
      )
    })
    return [t.blockStatement(inner)]
  }

  if (t.isWhileStatement(node)) {
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

  if (t.isFunctionDeclaration(node)) {
    const isInternalHelper = node.id?.name?.startsWith('__c_')
    if (isInternalHelper) {
      return [node]
    }
    const body = processBlock(node.body)
    const paramNames = node.params
      .map((p) => (t.isIdentifier(p) ? p.name : null))
      .filter(Boolean)
    const entryScope = scopeUpdates(paramNames)
    const wrappedBody =
      entryScope.length > 0
        ? t.blockStatement([...entryScope, ...body.body])
        : body
    return [
      step,
      t.functionDeclaration(node.id, node.params, wrappedBody, node.generator, true),
      ...updates,
    ]
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

    asyncifyFunctionsAndCalls(ast)

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
