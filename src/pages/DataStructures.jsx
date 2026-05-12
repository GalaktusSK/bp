import { useState, useRef, useCallback } from 'react'
import Page from '../components/Page'
import { dots } from '../utils'

const DS_TYPES = [
  { id: 'stack', label: 'Stack' },
  { id: 'queue', label: 'Queue' },
  { id: 'linked-list', label: 'Linked List' },
  { id: 'bst', label: 'Binary Tree' },
  { id: 'graph', label: 'Undirected Graph' },
  { id: 'digraph', label: 'Directed Graph' },
]

const C_SNIPPETS = {
  stack: `#include <stdio.h>
#define MAX 10

typedef struct {
    int data[MAX];
    int top;
} Stack;

void init(Stack *s)    { s->top = -1; }
int isEmpty(Stack *s)  { return s->top == -1; }
int isFull(Stack *s)   { return s->top == MAX - 1; }

void push(Stack *s, int val) {
    if (isFull(s)) { printf("Stack overflow\\n"); return; }
    s->data[++s->top] = val;
}

int pop(Stack *s) {
    if (isEmpty(s)) { printf("Stack underflow\\n"); return -1; }
    return s->data[s->top--];
}

int peek(Stack *s) {
    if (isEmpty(s)) return -1;
    return s->data[s->top];
}

void clear(Stack *s) {
    s->top = -1;
}`,

  queue: `#include <stdio.h>
#define MAX 10

typedef struct {
    int data[MAX];
    int front, rear;
} Queue;

void init(Queue *q)    { q->front = 0; q->rear = -1; }
int isEmpty(Queue *q)  { return q->rear < q->front; }
int isFull(Queue *q)   { return q->rear == MAX - 1; }

void enqueue(Queue *q, int val) {
    if (isFull(q)) { printf("Queue overflow\\n"); return; }
    q->data[++q->rear] = val;
}

int dequeue(Queue *q) {
    if (isEmpty(q)) { printf("Queue underflow\\n"); return -1; }
    return q->data[q->front++];
}

int front(Queue *q) {
    if (isEmpty(q)) return -1;
    return q->data[q->front];
}

void clear(Queue *q) {
    q->front = 0;
    q->rear = -1;
}`,

  'linked-list': `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node* createNode(int val) {
    Node *n = malloc(sizeof(Node));
    n->data = val;
    n->next = NULL;
    return n;
}

void pushFront(Node **head, int val) {
    Node *n = createNode(val);
    n->next = *head;
    *head = n;
}

void pushBack(Node **head, int val) {
    Node *n = createNode(val);
    if (!*head) { *head = n; return; }
    Node *cur = *head;
    while (cur->next) cur = cur->next;
    cur->next = n;
}

int popFront(Node **head) {
    if (!*head) return -1;
    Node *tmp = *head;
    int val = tmp->data;
    *head = tmp->next;
    free(tmp);
    return val;
}

void clear(Node **head) {
    while (*head) {
        Node *tmp = *head;
        *head = tmp->next;
        free(tmp);
    }
}`,

  bst: `#include <stdio.h>
#include <stdlib.h>

typedef struct BSTNode {
    int data;
    struct BSTNode *left;
    struct BSTNode *right;
} BSTNode;

BSTNode* createNode(int val) {
    BSTNode *n = malloc(sizeof(BSTNode));
    n->data = val;
    n->left = n->right = NULL;
    return n;
}

BSTNode* insert(BSTNode *root, int val) {
    if (!root) return createNode(val);
    if (val < root->data)
        root->left = insert(root->left, val);
    else if (val > root->data)
        root->right = insert(root->right, val);
    return root;
}

BSTNode* findMin(BSTNode *node) {
    while (node->left) node = node->left;
    return node;
}

BSTNode* delete(BSTNode *root, int val) {
    if (!root) return NULL;
    if (val < root->data)
        root->left = delete(root->left, val);
    else if (val > root->data)
        root->right = delete(root->right, val);
    else {
        if (!root->left) {
            BSTNode *tmp = root->right;
            free(root);
            return tmp;
        }
        if (!root->right) {
            BSTNode *tmp = root->left;
            free(root);
            return tmp;
        }
        BSTNode *min = findMin(root->right);
        root->data = min->data;
        root->right = delete(root->right, min->data);
    }
    return root;
}

BSTNode* search(BSTNode *root, int val) {
    if (!root || root->data == val) return root;
    if (val < root->data)
        return search(root->left, val);
    return search(root->right, val);
}

void clear(BSTNode *root) {
    if (!root) return;
    clear(root->left);
    clear(root->right);
    free(root);
}`,

  graph: `#include <stdio.h>
#define MAX 10

typedef struct {
    int adj[MAX][MAX];
    int n;
} Graph;

void init(Graph *g) {
    g->n = 0;
    for (int i = 0; i < MAX; i++)
        for (int j = 0; j < MAX; j++)
            g->adj[i][j] = 0;
}

int addVertex(Graph *g) {
    if (g->n >= MAX) { printf("Graph full\\n"); return -1; }
    return g->n++;
}

void addEdge(Graph *g, int u, int v) {
    if (u < 0 || u >= g->n || v < 0 || v >= g->n) return;
    g->adj[u][v] = 1;
    g->adj[v][u] = 1;
}

void removeEdge(Graph *g, int u, int v) {
    if (u < 0 || u >= g->n || v < 0 || v >= g->n) return;
    g->adj[u][v] = 0;
    g->adj[v][u] = 0;
}

void bfs(Graph *g, int start) {
    if (start < 0 || start >= g->n) return;
    int visited[MAX] = {0};
    int queue[MAX], front = 0, rear = 0;
    visited[start] = 1;
    queue[rear++] = start;
    while (front < rear) {
        int v = queue[front++];
        printf("%d ", v);
        for (int i = 0; i < g->n; i++)
            if (g->adj[v][i] && !visited[i]) {
                visited[i] = 1;
                queue[rear++] = i;
            }
    }
    printf("\\n");
}

void dfsHelper(Graph *g, int v, int *visited) {
    visited[v] = 1;
    printf("%d ", v);
    for (int i = 0; i < g->n; i++)
        if (g->adj[v][i] && !visited[i])
            dfsHelper(g, i, visited);
}

void dfs(Graph *g, int start) {
    if (start < 0 || start >= g->n) return;
    int visited[MAX] = {0};
    dfsHelper(g, start, visited);
    printf("\\n");
}

void clear(Graph *g) {
    init(g);
}`,

  digraph: `#include <stdio.h>
#define MAX 10

typedef struct {
    int adj[MAX][MAX];
    int n;
} DiGraph;

void init(DiGraph *g) {
    g->n = 0;
    for (int i = 0; i < MAX; i++)
        for (int j = 0; j < MAX; j++)
            g->adj[i][j] = 0;
}

int addVertex(DiGraph *g) {
    if (g->n >= MAX) { printf("Graph full\\n"); return -1; }
    return g->n++;
}

void addEdge(DiGraph *g, int u, int v) {
    if (u < 0 || u >= g->n || v < 0 || v >= g->n) return;
    g->adj[u][v] = 1;
}

void removeEdge(DiGraph *g, int u, int v) {
    if (u < 0 || u >= g->n || v < 0 || v >= g->n) return;
    g->adj[u][v] = 0;
}

void bfs(DiGraph *g, int start) {
    if (start < 0 || start >= g->n) return;
    int visited[MAX] = {0};
    int queue[MAX], front = 0, rear = 0;
    visited[start] = 1;
    queue[rear++] = start;
    while (front < rear) {
        int v = queue[front++];
        printf("%d ", v);
        for (int i = 0; i < g->n; i++)
            if (g->adj[v][i] && !visited[i]) {
                visited[i] = 1;
                queue[rear++] = i;
            }
    }
    printf("\\n");
}

void dfsHelper(DiGraph *g, int v, int *visited) {
    visited[v] = 1;
    printf("%d ", v);
    for (int i = 0; i < g->n; i++)
        if (g->adj[v][i] && !visited[i])
            dfsHelper(g, i, visited);
}

void dfs(DiGraph *g, int start) {
    if (start < 0 || start >= g->n) return;
    int visited[MAX] = {0};
    dfsHelper(g, start, visited);
    printf("\\n");
}

void clear(DiGraph *g) {
    init(g);
}`,
}

let nextId = 1
const ANIM_MS = 500

function StackViz() {
  const [items, setItems] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [animating, setAnimating] = useState(null)
  const [log, setLog] = useState([])
  const busyRef = useRef(false)

  const push = () => {
    if (busyRef.current) return
    const val = inputVal.trim() || String(Math.floor(Math.random() * 100))
    if (items.length >= 10) {
      setLog((l) => ['Stack overflow (max 10)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const id = nextId++
    setAnimating({ type: 'push', id })
    setItems((prev) => [...prev, { id, value: val }])
    setLog((l) => [`push(${val})`, ...l].slice(0, 8))
    setInputVal('')
    setTimeout(() => { setAnimating(null); busyRef.current = false }, ANIM_MS)
  }

  const pop = () => {
    if (busyRef.current) return
    if (items.length === 0) {
      setLog((l) => ['Stack underflow (empty)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const top = items[items.length - 1]
    setAnimating({ type: 'pop', id: top.id })
    setLog((l) => [`pop() → ${top.value}`, ...l].slice(0, 8))
    setTimeout(() => {
      setItems((prev) => prev.slice(0, -1))
      setAnimating(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const peek = () => {
    if (busyRef.current || items.length === 0) {
      if (items.length === 0) setLog((l) => ['peek() → empty', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const top = items[items.length - 1]
    setAnimating({ type: 'peek', id: top.id })
    setLog((l) => [`peek() → ${top.value}`, ...l].slice(0, 8))
    setTimeout(() => { setAnimating(null); busyRef.current = false }, 700)
  }

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && push()}
          placeholder="Value"
          className="ds-input"
        />
        <button type="button" className="ghost ds-btn" onClick={push}>Push</button>
        <button type="button" className="ghost ds-btn" onClick={pop}>Pop</button>
        <button type="button" className="ghost ds-btn" onClick={peek}>Peek</button>
        <button type="button" className="ghost ds-btn" onClick={() => { setItems([]); setLog([]); setAnimating(null); busyRef.current = false }}>Clear</button>
      </div>
      <div className="ds-canvas">
        <div className="stack-wrapper">
          <div className="stack-arrow-zone">
            <div className="stack-arrow-label">push &#x2193;</div>
            <div className="stack-arrow-label">&#x2191; pop</div>
          </div>
          <div className="stack-container">
            <div className="stack-box">
              {items.length === 0 && <div className="ds-empty">Empty stack</div>}
              {[...items].reverse().map((item, i) => {
                let cls = 'stack-item'
                if (animating?.id === item.id) {
                  if (animating.type === 'push') cls += ' stack-anim-push'
                  if (animating.type === 'pop') cls += ' stack-anim-pop'
                  if (animating.type === 'peek') cls += ' stack-anim-peek'
                }
                if (i === 0) cls += ' stack-top'
                return (
                  <div key={item.id} className={cls}>
                    <span className="stack-item-val">{item.value}</span>
                  </div>
                )
              })}
            </div>
            {items.length > 0 && (
              <div className="stack-labels">
                <span className="stack-ptr">&#x2190; TOP</span>
                <span className="stack-ptr">&#x2190; BOTTOM</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function QueueViz() {
  const [items, setItems] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [animating, setAnimating] = useState(null)
  const [log, setLog] = useState([])
  const busyRef = useRef(false)

  const enqueue = () => {
    if (busyRef.current) return
    const val = inputVal.trim() || String(Math.floor(Math.random() * 100))
    if (items.length >= 10) {
      setLog((l) => ['Queue overflow (max 10)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const id = nextId++
    setAnimating({ type: 'enqueue', id })
    setItems((prev) => [...prev, { id, value: val }])
    setLog((l) => [`enqueue(${val})`, ...l].slice(0, 8))
    setInputVal('')
    setTimeout(() => { setAnimating(null); busyRef.current = false }, 700)
  }

  const dequeue = () => {
    if (busyRef.current) return
    if (items.length === 0) {
      setLog((l) => ['Queue underflow (empty)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const front = items[0]
    setAnimating({ type: 'dequeue', id: front.id })
    setLog((l) => [`dequeue() → ${front.value}`, ...l].slice(0, 8))
    setTimeout(() => {
      setItems((prev) => prev.slice(1))
      setAnimating(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const peekFront = () => {
    if (busyRef.current || items.length === 0) {
      if (items.length === 0) setLog((l) => ['front() → empty', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const front = items[0]
    setAnimating({ type: 'peek', id: front.id })
    setLog((l) => [`front() → ${front.value}`, ...l].slice(0, 8))
    setTimeout(() => { setAnimating(null); busyRef.current = false }, 700)
  }

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enqueue()}
          placeholder="Value"
          className="ds-input"
        />
        <button type="button" className="ghost ds-btn" onClick={enqueue}>Enqueue</button>
        <button type="button" className="ghost ds-btn" onClick={dequeue}>Dequeue</button>
        <button type="button" className="ghost ds-btn" onClick={peekFront}>Front</button>
        <button type="button" className="ghost ds-btn" onClick={() => { setItems([]); setLog([]); setAnimating(null); busyRef.current = false }}>Clear</button>
      </div>
      <div className="ds-canvas">
        <div className="queue-wrapper">
          <div className="queue-flow-arrow queue-flow-left">
            <span>&#x2190; dequeue</span>
          </div>
          <div className="queue-container">
            <div className="queue-box">
              {items.length === 0 && <div className="ds-empty">Empty queue</div>}
              {items.map((item, i) => {
                let cls = 'queue-item'
                if (animating?.id === item.id) {
                  if (animating.type === 'enqueue') cls += ' queue-anim-enter'
                  if (animating.type === 'dequeue') cls += ' queue-anim-leave'
                  if (animating.type === 'peek') cls += ' stack-anim-peek'
                }
                if (i === 0) cls += ' queue-front'
                if (i === items.length - 1) cls += ' queue-rear'
                return (
                  <div key={item.id} className={cls}>
                    <span className="queue-item-val">{item.value}</span>
                    <span className="queue-item-label">
                      {i === 0 && items.length === 1 ? 'front / rear' : i === 0 ? 'front' : i === items.length - 1 ? 'rear' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="queue-flow-arrow queue-flow-right">
            <span>enqueue &#x2192;</span>
          </div>
        </div>
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function LinkedListViz() {
  const [items, setItems] = useState([])
  const [inputVal, setInputVal] = useState('')
  const [animating, setAnimating] = useState(null)
  const [log, setLog] = useState([])
  const busyRef = useRef(false)

  const pushFront = () => {
    if (busyRef.current) return
    const val = inputVal.trim() || String(Math.floor(Math.random() * 100))
    busyRef.current = true
    const id = nextId++
    setAnimating({ type: 'push-front', id })
    setItems((prev) => [{ id, value: val }, ...prev])
    setLog((l) => [`pushFront(${val})`, ...l].slice(0, 8))
    setInputVal('')
    setTimeout(() => { setAnimating(null); busyRef.current = false }, ANIM_MS)
  }

  const pushBack = () => {
    if (busyRef.current) return
    const val = inputVal.trim() || String(Math.floor(Math.random() * 100))
    busyRef.current = true
    const id = nextId++
    setAnimating({ type: 'push-back', id })
    setItems((prev) => [...prev, { id, value: val }])
    setLog((l) => [`pushBack(${val})`, ...l].slice(0, 8))
    setInputVal('')
    setTimeout(() => { setAnimating(null); busyRef.current = false }, ANIM_MS)
  }

  const popFront = () => {
    if (busyRef.current) return
    if (items.length === 0) {
      setLog((l) => ['popFront() → empty', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const head = items[0]
    setAnimating({ type: 'pop', id: head.id })
    setLog((l) => [`popFront() → ${head.value}`, ...l].slice(0, 8))
    setTimeout(() => {
      setItems((prev) => prev.slice(1))
      setAnimating(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && pushFront()}
          placeholder="Value"
          className="ds-input"
        />
        <button type="button" className="ghost ds-btn" onClick={pushFront}>Push Front</button>
        <button type="button" className="ghost ds-btn" onClick={pushBack}>Push Back</button>
        <button type="button" className="ghost ds-btn" onClick={popFront}>Pop Front</button>
        <button type="button" className="ghost ds-btn" onClick={() => { setItems([]); setLog([]); setAnimating(null); busyRef.current = false }}>Clear</button>
      </div>
      <div className="ds-canvas">
        <div className="ll-container">
          {items.length === 0 && <div className="ds-empty">Empty list</div>}
          <div className="ll-nodes">
            {items.map((item, i) => {
              let cls = 'll-node'
              if (animating?.id === item.id) {
                if (animating.type === 'push-front') cls += ' ll-anim-push-front'
                if (animating.type === 'push-back') cls += ' ll-anim-push-back'
                if (animating.type === 'pop') cls += ' ll-anim-pop'
              }
              const isHead = i === 0
              const isTail = i === items.length - 1
              return (
                <div key={item.id} className="ll-node-group">
                  <div className={cls}>
                    <span className="ll-node-label">
                      {isHead && isTail ? 'HEAD / TAIL' : isHead ? 'HEAD' : isTail ? 'TAIL' : ''}
                    </span>
                    <span className="ll-node-val">{item.value}</span>
                    <span className="ll-node-ptr">{i < items.length - 1 ? 'next &#x2192;' : 'NULL'}</span>
                  </div>
                  {i < items.length - 1 && <div className="ll-arrow">&#x2192;</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function bstInsert(node, val) {
  if (!node) return { val, left: null, right: null, id: nextId++ }
  if (val < node.val) return { ...node, left: bstInsert(node.left, val) }
  if (val > node.val) return { ...node, right: bstInsert(node.right, val) }
  return node
}

function bstFindMin(node) {
  while (node.left) node = node.left
  return node
}

function bstDelete(node, val) {
  if (!node) return null
  if (val < node.val) return { ...node, left: bstDelete(node.left, val) }
  if (val > node.val) return { ...node, right: bstDelete(node.right, val) }
  if (!node.left) return node.right
  if (!node.right) return node.left
  const min = bstFindMin(node.right)
  return { ...node, val: min.val, right: bstDelete(node.right, min.val) }
}

function bstSearch(node, val) {
  if (!node) return null
  if (val === node.val) return node.id
  if (val < node.val) return bstSearch(node.left, val)
  return bstSearch(node.right, val)
}

function bstSize(node) {
  if (!node) return 0
  return 1 + bstSize(node.left) + bstSize(node.right)
}

function bstHeight(node) {
  if (!node) return 0
  return 1 + Math.max(bstHeight(node.left), bstHeight(node.right))
}

function layoutTree(node, x, y, spread) {
  if (!node) return []
  const result = [{ ...node, x, y }]
  if (node.left) result.push(...layoutTree(node.left, x - spread, y + 70, spread * 0.55))
  if (node.right) result.push(...layoutTree(node.right, x + spread, y + 70, spread * 0.55))
  return result
}

function getEdges(node, x, y, spread) {
  if (!node) return []
  const edges = []
  if (node.left) {
    const cx = x - spread
    const cy = y + 70
    edges.push({ x1: x, y1: y, x2: cx, y2: cy })
    edges.push(...getEdges(node.left, cx, cy, spread * 0.55))
  }
  if (node.right) {
    const cx = x + spread
    const cy = y + 70
    edges.push({ x1: x, y1: y, x2: cx, y2: cy })
    edges.push(...getEdges(node.right, cx, cy, spread * 0.55))
  }
  return edges
}

function BSTViz() {
  const [tree, setTree] = useState(null)
  const [inputVal, setInputVal] = useState('')
  const [animating, setAnimating] = useState(null)
  const [log, setLog] = useState([])
  const busyRef = useRef(false)

  const insert = () => {
    if (busyRef.current) return
    const num = parseInt(inputVal.trim(), 10)
    const val = Number.isFinite(num) ? num : Math.floor(Math.random() * 100)
    if (bstSize(tree) >= 15) {
      setLog((l) => ['Tree full (max 15 nodes)', ...l].slice(0, 8))
      return
    }
    if (bstSearch(tree, val) !== null) {
      setLog((l) => [`${val} already exists`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const newTree = bstInsert(tree, val)
    const newId = bstSearch(newTree, val)
    setTree(newTree)
    setAnimating({ type: 'insert', id: newId })
    setLog((l) => [`insert(${val})`, ...l].slice(0, 8))
    setInputVal('')
    setTimeout(() => { setAnimating(null); busyRef.current = false }, ANIM_MS)
  }

  const remove = () => {
    if (busyRef.current) return
    const num = parseInt(inputVal.trim(), 10)
    if (!Number.isFinite(num)) return
    const found = bstSearch(tree, num)
    if (found === null) {
      setLog((l) => [`${num} not found`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    setAnimating({ type: 'delete', id: found })
    setLog((l) => [`delete(${num})`, ...l].slice(0, 8))
    setTimeout(() => {
      setTree((t) => bstDelete(t, num))
      setAnimating(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const search = () => {
    if (busyRef.current) return
    const num = parseInt(inputVal.trim(), 10)
    if (!Number.isFinite(num)) return
    busyRef.current = true
    const found = bstSearch(tree, num)
    if (found !== null) {
      setAnimating({ type: 'search', id: found })
      setLog((l) => [`search(${num}) → found`, ...l].slice(0, 8))
    } else {
      setLog((l) => [`search(${num}) → not found`, ...l].slice(0, 8))
    }
    setTimeout(() => { setAnimating(null); busyRef.current = false }, 800)
  }

  const height = bstHeight(tree)
  const spread = Math.min(180, 60 * Math.pow(1.5, height - 1))
  const centerX = 300
  const centerY = 30
  const nodes = layoutTree(tree, centerX, centerY, spread)
  const edges = getEdges(tree, centerX, centerY, spread)

  const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) - 30 : 0
  const maxX = nodes.length ? Math.max(...nodes.map((n) => n.x)) + 30 : 600
  const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) + 40 : 100
  const svgWidth = Math.max(600, maxX - minX)
  const svgHeight = Math.max(100, maxY + 10)
  const offsetX = -minX

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && insert()}
          placeholder="Number"
          className="ds-input"
        />
        <button type="button" className="ghost ds-btn" onClick={insert}>Insert</button>
        <button type="button" className="ghost ds-btn" onClick={remove}>Delete</button>
        <button type="button" className="ghost ds-btn" onClick={search}>Search</button>
        <button type="button" className="ghost ds-btn" onClick={() => { setTree(null); setLog([]); setAnimating(null); busyRef.current = false }}>Clear</button>
      </div>
      <div className="ds-canvas bst-canvas">
        {!tree && <div className="ds-empty">Empty tree — insert a number to start</div>}
        {tree && (
          <svg width={svgWidth} height={svgHeight} className="bst-svg">
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1 + offsetX}
                y1={e.y1}
                x2={e.x2 + offsetX}
                y2={e.y2}
                className="bst-edge"
              />
            ))}
            {nodes.map((n) => {
              let cls = 'bst-node'
              if (animating?.id === n.id) {
                if (animating.type === 'insert') cls += ' bst-anim-insert'
                if (animating.type === 'delete') cls += ' bst-anim-delete'
                if (animating.type === 'search') cls += ' bst-anim-search'
              }
              return (
                <g key={n.id} transform={`translate(${n.x + offsetX}, ${n.y})`} className={cls}>
                  <circle r="20" />
                  <text dy="5" textAnchor="middle">{n.val}</text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function GraphViz() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')
  const [log, setLog] = useState([])
  const [highlighted, setHighlighted] = useState(new Set())
  const [animNode, setAnimNode] = useState(null)
  const [animEdge, setAnimEdge] = useState(null)
  const busyRef = useRef(false)
  const nextLabel = useRef(0)
  const travRef = useRef(0)

  const addVertex = () => {
    if (busyRef.current) return
    if (nodes.length >= 10) {
      setLog((l) => ['Graph full (max 10 vertices)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const label = nextLabel.current++
    const id = nextId++
    setAnimNode({ type: 'enter', id })
    setNodes((prev) => [...prev, { id, label }])
    setLog((l) => [`addVertex() → ${label}`, ...l].slice(0, 8))
    setTimeout(() => { setAnimNode(null); busyRef.current = false }, ANIM_MS)
  }

  const removeVertex = () => {
    if (busyRef.current) return
    const label = parseInt(inputA.trim(), 10)
    if (!Number.isFinite(label)) return
    const node = nodes.find((n) => n.label === label)
    if (!node) {
      setLog((l) => [`Vertex ${label} not found`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    setAnimNode({ type: 'exit', id: node.id })
    setLog((l) => [`removeVertex(${label})`, ...l].slice(0, 8))
    setInputA('')
    setTimeout(() => {
      setNodes((prev) => prev.filter((n) => n.label !== label))
      setEdges((prev) => prev.filter((e) => e.from !== label && e.to !== label))
      setAnimNode(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const addEdge = () => {
    if (busyRef.current) return
    const from = parseInt(inputA.trim(), 10)
    const to = parseInt(inputB.trim(), 10)
    if (!Number.isFinite(from) || !Number.isFinite(to)) return
    if (from === to) {
      setLog((l) => ['Self-loops not allowed', ...l].slice(0, 8))
      return
    }
    if (!nodes.find((n) => n.label === from) || !nodes.find((n) => n.label === to)) {
      setLog((l) => ['Vertex not found', ...l].slice(0, 8))
      return
    }
    if (edges.find((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) {
      setLog((l) => [`Edge ${from}–${to} already exists`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const id = nextId++
    setAnimEdge({ type: 'enter', id })
    setEdges((prev) => [...prev, { id, from, to }])
    setLog((l) => [`addEdge(${from}, ${to})`, ...l].slice(0, 8))
    setInputA('')
    setInputB('')
    setTimeout(() => { setAnimEdge(null); busyRef.current = false }, ANIM_MS)
  }

  const removeEdge = () => {
    if (busyRef.current) return
    const from = parseInt(inputA.trim(), 10)
    const to = parseInt(inputB.trim(), 10)
    if (!Number.isFinite(from) || !Number.isFinite(to)) return
    const edge = edges.find((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))
    if (!edge) {
      setLog((l) => [`Edge ${from}–${to} not found`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    setAnimEdge({ type: 'exit', id: edge.id })
    setLog((l) => [`removeEdge(${from}, ${to})`, ...l].slice(0, 8))
    setInputA('')
    setInputB('')
    setTimeout(() => {
      setEdges((prev) => prev.filter((e) => e.id !== edge.id))
      setAnimEdge(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const traverse = (type) => {
    if (busyRef.current) return
    const start = parseInt(inputA.trim(), 10)
    if (!Number.isFinite(start) || !nodes.find((n) => n.label === start)) {
      setLog((l) => ['Enter valid start vertex in first input', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const tid = ++travRef.current
    const adj = {}
    nodes.forEach((n) => (adj[n.label] = []))
    edges.forEach((e) => {
      adj[e.from]?.push(e.to)
      adj[e.to]?.push(e.from)
    })
    const order = []
    const visited = new Set()
    if (type === 'bfs') {
      const queue = [start]
      visited.add(start)
      while (queue.length) {
        const v = queue.shift()
        order.push(v)
        for (const u of (adj[v] || []).sort((a, b) => a - b)) {
          if (!visited.has(u)) { visited.add(u); queue.push(u) }
        }
      }
    } else {
      const go = (v) => {
        visited.add(v)
        order.push(v)
        for (const u of (adj[v] || []).sort((a, b) => a - b))
          if (!visited.has(u)) go(u)
      }
      go(start)
    }
    setLog((l) => [`${type.toUpperCase()}(${start}): ${order.join(' → ')}`, ...l].slice(0, 8))
    const hl = new Set()
    order.forEach((label, i) => {
      setTimeout(() => {
        if (travRef.current !== tid) return
        hl.add(label)
        setHighlighted(new Set(hl))
        if (i === order.length - 1) {
          setTimeout(() => {
            if (travRef.current !== tid) return
            setHighlighted(new Set())
            busyRef.current = false
          }, 1200)
        }
      }, (i + 1) * 700)
    })
    if (order.length === 0) busyRef.current = false
  }

  const clearAll = () => {
    travRef.current++
    setNodes([])
    setEdges([])
    setLog([])
    setAnimNode(null)
    setAnimEdge(null)
    setHighlighted(new Set())
    nextLabel.current = 0
    busyRef.current = false
  }

  const svgW = 500, svgH = 360
  const cx = svgW / 2, cy = svgH / 2, r = 130
  const positions = {}
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
    positions[n.label] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  })

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input type="text" value={inputA} onChange={(e) => setInputA(e.target.value)} placeholder="From" className="ds-input" />
        <input type="text" value={inputB} onChange={(e) => setInputB(e.target.value)} placeholder="To" className="ds-input" />
        <button type="button" className="ghost ds-btn" onClick={addVertex}>Add Vertex</button>
        <button type="button" className="ghost ds-btn" onClick={removeVertex}>Rm Vertex</button>
        <button type="button" className="ghost ds-btn" onClick={addEdge}>Add Edge</button>
        <button type="button" className="ghost ds-btn" onClick={removeEdge}>Rm Edge</button>
        <button type="button" className="ghost ds-btn" onClick={() => traverse('bfs')}>BFS</button>
        <button type="button" className="ghost ds-btn" onClick={() => traverse('dfs')}>DFS</button>
        <button type="button" className="ghost ds-btn" onClick={clearAll}>Clear</button>
      </div>
      <div className="ds-canvas graph-canvas">
        {nodes.length === 0 && <div className="ds-empty">Empty graph — add vertices to start</div>}
        {nodes.length > 0 && (
          <svg width={svgW} height={svgH} className="graph-svg">
            {edges.map((e) => {
              const p1 = positions[e.from]
              const p2 = positions[e.to]
              if (!p1 || !p2) return null
              let cls = 'graph-edge'
              if (animEdge?.id === e.id) {
                if (animEdge.type === 'enter') cls += ' graph-edge-draw'
                if (animEdge.type === 'exit') cls += ' graph-edge-fade'
              }
              if (highlighted.has(e.from) && highlighted.has(e.to)) cls += ' graph-edge-hl'
              return <line key={e.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={cls} />
            })}
            {nodes.map((n) => {
              const pos = positions[n.label]
              let cls = 'graph-node'
              if (animNode?.id === n.id) {
                if (animNode.type === 'enter') cls += ' graph-node-enter'
                if (animNode.type === 'exit') cls += ' graph-node-exit'
              }
              if (highlighted.has(n.label)) cls += ' graph-node-hl'
              return (
                <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`} className={cls}>
                  <circle r="22" />
                  <text dy="5" textAnchor="middle">{n.label}</text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function DiGraphViz() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')
  const [log, setLog] = useState([])
  const [highlighted, setHighlighted] = useState(new Set())
  const [animNode, setAnimNode] = useState(null)
  const [animEdge, setAnimEdge] = useState(null)
  const busyRef = useRef(false)
  const nextLabel = useRef(0)
  const travRef = useRef(0)

  const addVertex = () => {
    if (busyRef.current) return
    if (nodes.length >= 10) {
      setLog((l) => ['Graph full (max 10 vertices)', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const label = nextLabel.current++
    const id = nextId++
    setAnimNode({ type: 'enter', id })
    setNodes((prev) => [...prev, { id, label }])
    setLog((l) => [`addVertex() → ${label}`, ...l].slice(0, 8))
    setTimeout(() => { setAnimNode(null); busyRef.current = false }, ANIM_MS)
  }

  const removeVertex = () => {
    if (busyRef.current) return
    const label = parseInt(inputA.trim(), 10)
    if (!Number.isFinite(label)) return
    const node = nodes.find((n) => n.label === label)
    if (!node) {
      setLog((l) => [`Vertex ${label} not found`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    setAnimNode({ type: 'exit', id: node.id })
    setLog((l) => [`removeVertex(${label})`, ...l].slice(0, 8))
    setInputA('')
    setTimeout(() => {
      setNodes((prev) => prev.filter((n) => n.label !== label))
      setEdges((prev) => prev.filter((e) => e.from !== label && e.to !== label))
      setAnimNode(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const addEdge = () => {
    if (busyRef.current) return
    const from = parseInt(inputA.trim(), 10)
    const to = parseInt(inputB.trim(), 10)
    if (!Number.isFinite(from) || !Number.isFinite(to)) return
    if (from === to) {
      setLog((l) => ['Self-loops not allowed', ...l].slice(0, 8))
      return
    }
    if (!nodes.find((n) => n.label === from) || !nodes.find((n) => n.label === to)) {
      setLog((l) => ['Vertex not found', ...l].slice(0, 8))
      return
    }
    if (edges.find((e) => e.from === from && e.to === to)) {
      setLog((l) => [`Edge ${from}→${to} already exists`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const id = nextId++
    setAnimEdge({ type: 'enter', id })
    setEdges((prev) => [...prev, { id, from, to }])
    setLog((l) => [`addEdge(${from}, ${to})`, ...l].slice(0, 8))
    setInputA('')
    setInputB('')
    setTimeout(() => { setAnimEdge(null); busyRef.current = false }, ANIM_MS)
  }

  const removeEdge = () => {
    if (busyRef.current) return
    const from = parseInt(inputA.trim(), 10)
    const to = parseInt(inputB.trim(), 10)
    if (!Number.isFinite(from) || !Number.isFinite(to)) return
    const edge = edges.find((e) => e.from === from && e.to === to)
    if (!edge) {
      setLog((l) => [`Edge ${from}→${to} not found`, ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    setAnimEdge({ type: 'exit', id: edge.id })
    setLog((l) => [`removeEdge(${from}, ${to})`, ...l].slice(0, 8))
    setInputA('')
    setInputB('')
    setTimeout(() => {
      setEdges((prev) => prev.filter((e) => e.id !== edge.id))
      setAnimEdge(null)
      busyRef.current = false
    }, ANIM_MS)
  }

  const traverse = (type) => {
    if (busyRef.current) return
    const start = parseInt(inputA.trim(), 10)
    if (!Number.isFinite(start) || !nodes.find((n) => n.label === start)) {
      setLog((l) => ['Enter valid start vertex in first input', ...l].slice(0, 8))
      return
    }
    busyRef.current = true
    const tid = ++travRef.current
    const adj = {}
    nodes.forEach((n) => (adj[n.label] = []))
    edges.forEach((e) => { adj[e.from]?.push(e.to) })
    const order = []
    const visited = new Set()
    if (type === 'bfs') {
      const queue = [start]
      visited.add(start)
      while (queue.length) {
        const v = queue.shift()
        order.push(v)
        for (const u of (adj[v] || []).sort((a, b) => a - b)) {
          if (!visited.has(u)) { visited.add(u); queue.push(u) }
        }
      }
    } else {
      const go = (v) => {
        visited.add(v)
        order.push(v)
        for (const u of (adj[v] || []).sort((a, b) => a - b))
          if (!visited.has(u)) go(u)
      }
      go(start)
    }
    setLog((l) => [`${type.toUpperCase()}(${start}): ${order.join(' → ')}`, ...l].slice(0, 8))
    const hl = new Set()
    order.forEach((label, i) => {
      setTimeout(() => {
        if (travRef.current !== tid) return
        hl.add(label)
        setHighlighted(new Set(hl))
        if (i === order.length - 1) {
          setTimeout(() => {
            if (travRef.current !== tid) return
            setHighlighted(new Set())
            busyRef.current = false
          }, 1200)
        }
      }, (i + 1) * 700)
    })
    if (order.length === 0) busyRef.current = false
  }

  const clearAll = () => {
    travRef.current++
    setNodes([])
    setEdges([])
    setLog([])
    setAnimNode(null)
    setAnimEdge(null)
    setHighlighted(new Set())
    nextLabel.current = 0
    busyRef.current = false
  }

  const svgW = 500, svgH = 360
  const cx = svgW / 2, cy = svgH / 2, rad = 130
  const positions = {}
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2
    positions[n.label] = {
      x: cx + rad * Math.cos(angle),
      y: cy + rad * Math.sin(angle),
    }
  })

  return (
    <div className="ds-viz">
      <div className="ds-controls">
        <input type="text" value={inputA} onChange={(e) => setInputA(e.target.value)} placeholder="From" className="ds-input" />
        <input type="text" value={inputB} onChange={(e) => setInputB(e.target.value)} placeholder="To" className="ds-input" />
        <button type="button" className="ghost ds-btn" onClick={addVertex}>Add Vertex</button>
        <button type="button" className="ghost ds-btn" onClick={removeVertex}>Rm Vertex</button>
        <button type="button" className="ghost ds-btn" onClick={addEdge}>Add Edge</button>
        <button type="button" className="ghost ds-btn" onClick={removeEdge}>Rm Edge</button>
        <button type="button" className="ghost ds-btn" onClick={() => traverse('bfs')}>BFS</button>
        <button type="button" className="ghost ds-btn" onClick={() => traverse('dfs')}>DFS</button>
        <button type="button" className="ghost ds-btn" onClick={clearAll}>Clear</button>
      </div>
      <div className="ds-canvas graph-canvas">
        {nodes.length === 0 && <div className="ds-empty">Empty graph — add vertices to start</div>}
        {nodes.length > 0 && (
          <svg width={svgW} height={svgH} className="graph-svg">
            <defs>
              <marker id="dg-arr" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 12 4, 0 8" fill="#2f4a63" />
              </marker>
              <marker id="dg-arr-hl" markerWidth="12" markerHeight="8" refX="12" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 12 4, 0 8" fill="#16a34a" />
              </marker>
            </defs>
            {edges.map((e) => {
              const p1 = positions[e.from]
              const p2 = positions[e.to]
              if (!p1 || !p2) return null
              const dx = p2.x - p1.x
              const dy = p2.y - p1.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              const ux = dx / len
              const uy = dy / len
              const nx = -uy
              const ny = ux
              const hasReverse = edges.some((o) => o.from === e.to && o.to === e.from)
              const curve = hasReverse ? 20 : 0
              const x1 = p1.x + ux * 24
              const y1 = p1.y + uy * 24
              const x2 = p2.x - ux * 24
              const y2 = p2.y - uy * 24
              const mx = (p1.x + p2.x) / 2 + nx * curve
              const my = (p1.y + p2.y) / 2 + ny * curve
              const d = curve
                ? `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
                : `M ${x1} ${y1} L ${x2} ${y2}`
              let cls = 'digraph-edge'
              if (animEdge?.id === e.id) {
                if (animEdge.type === 'enter') cls += ' digraph-edge-draw'
                if (animEdge.type === 'exit') cls += ' digraph-edge-fade'
              }
              const isHl = highlighted.has(e.from) && highlighted.has(e.to)
              if (isHl) cls += ' digraph-edge-hl'
              return <path key={e.id} d={d} className={cls} markerEnd={isHl ? 'url(#dg-arr-hl)' : 'url(#dg-arr)'} />
            })}
            {nodes.map((n) => {
              const pos = positions[n.label]
              let cls = 'graph-node'
              if (animNode?.id === n.id) {
                if (animNode.type === 'enter') cls += ' graph-node-enter'
                if (animNode.type === 'exit') cls += ' graph-node-exit'
              }
              if (highlighted.has(n.label)) cls += ' graph-node-hl'
              return (
                <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`} className={cls}>
                  <circle r="22" />
                  <text dy="5" textAnchor="middle">{n.label}</text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
      <OperationsLog log={log} />
    </div>
  )
}

function OperationsLog({ log }) {
  return (
    <div className="ds-log">
      <div className="ds-log-title">Operations</div>
      {log.length === 0 && <div className="ds-log-entry ds-log-empty">No operations yet</div>}
      {log.map((entry, i) => (
        <div key={i} className={`ds-log-entry ${i === 0 ? 'ds-log-latest' : ''}`}>{entry}</div>
      ))}
    </div>
  )
}

const VIZ_COMPONENTS = {
  stack: StackViz,
  queue: QueueViz,
  'linked-list': LinkedListViz,
  bst: BSTViz,
  graph: GraphViz,
  digraph: DiGraphViz,
}

function DataStructures({ currentRoute }) {
  const [selected, setSelected] = useState('stack')
  const VizComponent = VIZ_COMPONENTS[selected]

  return (
    <Page
      label="Data Structures"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="ds-page">
        <aside className="sidebar">
          <p className="eyebrow">OCV</p>
          <h4>Data Structures</h4>
          <p className="muted small">Structure</p>
          {DS_TYPES.map((ds) => (
            <button
              key={ds.id}
              type="button"
              className={`sidebar__item ${selected === ds.id ? 'active' : ''}`}
              onClick={() => setSelected(ds.id)}
            >
              {ds.label}
            </button>
          ))}
        </aside>

        <div className="ds-main">
          <div className="ds-viz-section">
            <div className="ds-viz-header">{DS_TYPES.find((d) => d.id === selected)?.label} Visualization</div>
            <VizComponent />
          </div>
          <div className="ds-code-section">
            <div className="ds-code-header">C Implementation</div>
            <pre className="ds-code-block"><code>{C_SNIPPETS[selected]}</code></pre>
          </div>
        </div>
      </div>
    </Page>
  )
}

export default DataStructures
