import { useState, useEffect, useRef } from 'react'
import Page from '../components/Page'
import { dots } from '../utils'

const ALGO_TYPES = [
  { id: 'bubble', label: 'Bubble Sort' },
  { id: 'selection', label: 'Selection Sort' },
  { id: 'insertion', label: 'Insertion Sort' },
  { id: 'binary-search', label: 'Binary Search' },
  { id: 'dijkstra', label: "Dijkstra's Algorithm" },
  { id: 'astar', label: 'A* Algorithm' },
]

const C_SNIPPETS = {
  bubble: `#include <stdio.h>

void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - 1 - i; j++)
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++)
        printf("%d ", arr[i]);
    printf("\\n");
}`,

  selection: `#include <stdio.h>

void selectionSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[minIdx])
                minIdx = j;
        int tmp = arr[i];
        arr[i] = arr[minIdx];
        arr[minIdx] = tmp;
    }
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++)
        printf("%d ", arr[i]);
    printf("\\n");
}`,

  insertion: `#include <stdio.h>

void insertionSort(int arr[], int n) {
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}

void printArray(int arr[], int n) {
    for (int i = 0; i < n; i++)
        printf("%d ", arr[i]);
    printf("\\n");
}`,

  'binary-search': `#include <stdio.h>

int binarySearch(int arr[], int n, int target) {
    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = (low + high) / 2;
        if (arr[mid] == target)
            return mid;
        if (arr[mid] < target)
            low = mid + 1;
        else
            high = mid - 1;
    }
    return -1;
}`,

  dijkstra: `#include <stdio.h>
#include <limits.h>
#define ROWS 12
#define COLS 20

int grid[ROWS][COLS], dist[ROWS][COLS];
int vis[ROWS][COLS];
int pR[ROWS][COLS], pC[ROWS][COLS];
int dr[] = {-1, 1, 0, 0};
int dc[] = {0, 0, -1, 1};

void dijkstra(int sr, int sc, int er, int ec) {
    for (int i = 0; i < ROWS; i++)
        for (int j = 0; j < COLS; j++) {
            dist[i][j] = INT_MAX;
            vis[i][j] = 0;
            pR[i][j] = pC[i][j] = -1;
        }
    dist[sr][sc] = 0;

    while (1) {
        int md = INT_MAX, cr = -1, cc = -1;
        for (int i = 0; i < ROWS; i++)
            for (int j = 0; j < COLS; j++)
                if (!vis[i][j] && dist[i][j] < md) {
                    md = dist[i][j];
                    cr = i; cc = j;
                }
        if (cr < 0 || (cr == er && cc == ec))
            break;
        vis[cr][cc] = 1;

        for (int d = 0; d < 4; d++) {
            int nr = cr+dr[d], nc = cc+dc[d];
            if (nr<0 || nr>=ROWS ||
                nc<0 || nc>=COLS) continue;
            if (grid[nr][nc] || vis[nr][nc]) continue;
            if (dist[cr][cc]+1 < dist[nr][nc]) {
                dist[nr][nc] = dist[cr][cc] + 1;
                pR[nr][nc] = cr;
                pC[nr][nc] = cc;
            }
        }
    }
}`,

  astar: `#include <stdio.h>
#include <stdlib.h>
#include <limits.h>
#define ROWS 12
#define COLS 20

int grid[ROWS][COLS];
int gC[ROWS][COLS], fC[ROWS][COLS];
int closed[ROWS][COLS];
int pR[ROWS][COLS], pC[ROWS][COLS];
int dr[] = {-1, 1, 0, 0};
int dc[] = {0, 0, -1, 1};

int h(int r, int c, int er, int ec) {
    return abs(r - er) + abs(c - ec);
}

void astar(int sr, int sc, int er, int ec) {
    for (int i = 0; i < ROWS; i++)
        for (int j = 0; j < COLS; j++) {
            gC[i][j] = fC[i][j] = INT_MAX;
            closed[i][j] = 0;
            pR[i][j] = pC[i][j] = -1;
        }
    gC[sr][sc] = 0;
    fC[sr][sc] = h(sr, sc, er, ec);

    while (1) {
        int mf = INT_MAX, cr = -1, cc = -1;
        for (int i = 0; i < ROWS; i++)
            for (int j = 0; j < COLS; j++)
                if (!closed[i][j] && fC[i][j] < mf) {
                    mf = fC[i][j];
                    cr = i; cc = j;
                }
        if (cr < 0 || (cr == er && cc == ec))
            break;
        closed[cr][cc] = 1;

        for (int d = 0; d < 4; d++) {
            int nr = cr+dr[d], nc = cc+dc[d];
            if (nr<0 || nr>=ROWS ||
                nc<0 || nc>=COLS) continue;
            if (grid[nr][nc] || closed[nr][nc])
                continue;
            int ng = gC[cr][cc] + 1;
            if (ng < gC[nr][nc]) {
                gC[nr][nc] = ng;
                fC[nr][nc] = ng + h(nr,nc,er,ec);
                pR[nr][nc] = cr;
                pC[nr][nc] = cc;
            }
        }
    }
}`,
}

const BAR_W = 28
const BAR_TOTAL = 32
const BAR_H = 16
const SORT_SIZE = 12

function shuffle(n) {
  const arr = Array.from({ length: n }, (_, i) => ({ id: i, value: i + 1 }))
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function cloneArr(a) { return a.map(e => ({ ...e })) }

function sortedColors(sorted) {
  const c = {}
  sorted.forEach(s => (c[s] = 'sorted'))
  return c
}

function genBubbleSteps(input) {
  const a = cloneArr(input)
  const steps = []
  const done = new Set()
  steps.push({ arr: cloneArr(a), colors: {}, desc: 'Initial array' })
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      const c = sortedColors(done)
      c[j] = 'comparing'; c[j + 1] = 'comparing'
      steps.push({ arr: cloneArr(a), colors: c, desc: `Compare ${a[j].value} and ${a[j + 1].value}` })
      if (a[j].value > a[j + 1].value) {
        ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
        const sc = sortedColors(done)
        sc[j] = 'swap'; sc[j + 1] = 'swap'
        steps.push({ arr: cloneArr(a), colors: sc, desc: `Swap ${a[j].value} ↔ ${a[j + 1].value}` })
      }
    }
    done.add(a.length - 1 - i)
  }
  done.add(0)
  steps.push({ arr: cloneArr(a), colors: sortedColors(done), desc: 'Array sorted!' })
  return steps
}

function genSelectionSteps(input) {
  const a = cloneArr(input)
  const steps = []
  const done = new Set()
  steps.push({ arr: cloneArr(a), colors: {}, desc: 'Initial array' })
  for (let i = 0; i < a.length - 1; i++) {
    let minIdx = i
    const c0 = sortedColors(done)
    c0[i] = 'pivot'
    steps.push({ arr: cloneArr(a), colors: c0, desc: `Find minimum starting from index ${i}` })
    for (let j = i + 1; j < a.length; j++) {
      const c = sortedColors(done)
      c[minIdx] = 'pivot'; c[j] = 'comparing'
      steps.push({ arr: cloneArr(a), colors: c, desc: `Compare ${a[j].value} with current min ${a[minIdx].value}` })
      if (a[j].value < a[minIdx].value) minIdx = j
    }
    if (minIdx !== i) {
      const c1 = sortedColors(done)
      c1[i] = 'swap'; c1[minIdx] = 'swap'
      steps.push({ arr: cloneArr(a), colors: c1, desc: `Swap ${a[i].value} ↔ ${a[minIdx].value}` })
      ;[a[i], a[minIdx]] = [a[minIdx], a[i]]
      const c2 = sortedColors(done)
      c2[i] = 'swap'; c2[minIdx] = 'swap'
      steps.push({ arr: cloneArr(a), colors: c2, desc: `Swapped` })
    }
    done.add(i)
  }
  done.add(a.length - 1)
  steps.push({ arr: cloneArr(a), colors: sortedColors(done), desc: 'Array sorted!' })
  return steps
}

function genInsertionSteps(input) {
  const a = cloneArr(input)
  const steps = []
  steps.push({ arr: cloneArr(a), colors: { 0: 'sorted' }, desc: 'First element is trivially sorted' })
  for (let i = 1; i < a.length; i++) {
    const sc = {}
    for (let k = 0; k < i; k++) sc[k] = 'sorted'
    sc[i] = 'pivot'
    steps.push({ arr: cloneArr(a), colors: sc, desc: `Insert ${a[i].value} into sorted portion` })
    let j = i
    while (j > 0 && a[j - 1].value > a[j].value) {
      const cc = {}
      for (let k = 0; k < i; k++) cc[k] = 'sorted'
      cc[j] = 'comparing'; cc[j - 1] = 'comparing'
      steps.push({ arr: cloneArr(a), colors: cc, desc: `${a[j].value} < ${a[j - 1].value}` })
      ;[a[j], a[j - 1]] = [a[j - 1], a[j]]
      const sc2 = {}
      for (let k = 0; k < i; k++) sc2[k] = 'sorted'
      sc2[j] = 'swap'; sc2[j - 1] = 'swap'
      steps.push({ arr: cloneArr(a), colors: sc2, desc: `Swap` })
      j--
    }
    const fc = {}
    for (let k = 0; k <= i; k++) fc[k] = 'sorted'
    steps.push({ arr: cloneArr(a), colors: fc, desc: `${a[j].value} placed at position ${j}` })
  }
  const fc = {}
  for (let k = 0; k < a.length; k++) fc[k] = 'sorted'
  steps.push({ arr: cloneArr(a), colors: fc, desc: 'Array sorted!' })
  return steps
}

const SORT_GENERATORS = {
  bubble: genBubbleSteps,
  selection: genSelectionSteps,
  insertion: genInsertionSteps,
}

function SortViz({ algorithm }) {
  const [steps, setSteps] = useState(() => SORT_GENERATORS[algorithm](shuffle(SORT_SIZE)))
  const [stepIdx, setStepIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(300)

  const generate = () => {
    setPlaying(false)
    setSteps(SORT_GENERATORS[algorithm](shuffle(SORT_SIZE)))
    setStepIdx(0)
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
    } else {
      if (stepIdx >= steps.length - 1) setStepIdx(0)
      setPlaying(true)
    }
  }

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(timer)
  }, [playing, speed, steps.length])

  const step = steps[stepIdx]
  const arr = step?.arr || []
  const totalW = arr.length * BAR_TOTAL
  const transMs = Math.min(speed * 0.7, 250)

  return (
    <div className="ds-viz">
      <div className="ds-controls algo-controls">
        <button type="button" className="ghost ds-btn" onClick={generate}>Generate</button>
        <button type="button" className="ghost ds-btn" onClick={togglePlay}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="ghost ds-btn"
          onClick={() => stepIdx < steps.length - 1 && setStepIdx((s) => s + 1)}
          disabled={playing}
        >
          Step
        </button>
        <button type="button" className="ghost ds-btn" onClick={() => { setStepIdx(0); setPlaying(false) }}>
          Reset
        </button>
        <div className="algo-speed">
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 600 ? 'active' : ''}`} onClick={() => setSpeed(600)}>Slow</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 300 ? 'active' : ''}`} onClick={() => setSpeed(300)}>Normal</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 100 ? 'active' : ''}`} onClick={() => setSpeed(100)}>Fast</button>
        </div>
        <span className="algo-progress">{stepIdx + 1} / {steps.length}</span>
      </div>
      <div className="ds-canvas algo-canvas">
        <div className="sort-container" style={{ width: totalW, height: SORT_SIZE * BAR_H + 30 }}>
          {arr.map((el, idx) => (
            <div
              key={el.id}
              className={`sort-bar sort-bar-${step.colors[idx] || 'default'}`}
              style={{
                left: idx * BAR_TOTAL,
                height: el.value * BAR_H,
                width: BAR_W,
                transition: `left ${transMs}ms ease, background-color 0.15s`,
              }}
            >
              <span className="sort-bar-label">{el.value}</span>
            </div>
          ))}
        </div>
        <div className="algo-step-desc">{step?.desc || ''}</div>
      </div>
    </div>
  )
}

function generateSorted(n) {
  const arr = []
  let v = Math.floor(Math.random() * 3) + 1
  for (let i = 0; i < n; i++) {
    arr.push(v)
    v += Math.floor(Math.random() * 4) + 2
  }
  return arr
}

function genBinarySearchSteps(arr, target) {
  const steps = []
  let low = 0, high = arr.length - 1
  steps.push({ low, high, mid: -1, found: -1, desc: `Search for ${target}` })
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    steps.push({ low, high, mid, found: -1, desc: `mid = ${mid}, arr[${mid}] = ${arr[mid]}` })
    if (arr[mid] === target) {
      steps.push({ low, high, mid, found: mid, desc: `Found ${target} at index ${mid}!` })
      return steps
    }
    if (arr[mid] < target) {
      steps.push({ low, high, mid, found: -1, desc: `${arr[mid]} < ${target} → search right half` })
      low = mid + 1
    } else {
      steps.push({ low, high, mid, found: -1, desc: `${arr[mid]} > ${target} → search left half` })
      high = mid - 1
    }
  }
  steps.push({ low: -1, high: -1, mid: -1, found: -1, desc: `${target} not found` })
  return steps
}

const BS_SIZE = 15

function BinarySearchViz() {
  const [arr, setArr] = useState(() => generateSorted(BS_SIZE))
  const [target, setTarget] = useState('')
  const [steps, setSteps] = useState([])
  const [stepIdx, setStepIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)

  const generate = () => {
    setArr(generateSorted(BS_SIZE))
    setSteps([])
    setStepIdx(-1)
    setPlaying(false)
  }

  const startSearch = () => {
    const t = parseInt(target, 10)
    if (!Number.isFinite(t)) return
    setPlaying(false)
    const newSteps = genBinarySearchSteps(arr, t)
    setSteps(newSteps)
    setStepIdx(0)
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
    } else {
      if (steps.length === 0) return
      if (stepIdx >= steps.length - 1) setStepIdx(0)
      setPlaying(true)
    }
  }

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(timer)
  }, [playing, speed, steps.length])

  const step = stepIdx >= 0 && stepIdx < steps.length ? steps[stepIdx] : null

  return (
    <div className="ds-viz">
      <div className="ds-controls algo-controls">
        <input
          type="text"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && startSearch()}
          placeholder="Target"
          className="ds-input"
        />
        <button type="button" className="ghost ds-btn" onClick={startSearch}>Search</button>
        <button type="button" className="ghost ds-btn" onClick={togglePlay} disabled={steps.length === 0}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="ghost ds-btn"
          onClick={() => stepIdx < steps.length - 1 && setStepIdx((s) => s + 1)}
          disabled={playing || steps.length === 0}
        >
          Step
        </button>
        <button type="button" className="ghost ds-btn" onClick={() => { setStepIdx(0); setPlaying(false) }} disabled={steps.length === 0}>
          Reset
        </button>
        <button type="button" className="ghost ds-btn" onClick={generate}>New Array</button>
        <div className="algo-speed">
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 1000 ? 'active' : ''}`} onClick={() => setSpeed(1000)}>Slow</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 600 ? 'active' : ''}`} onClick={() => setSpeed(600)}>Normal</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 300 ? 'active' : ''}`} onClick={() => setSpeed(300)}>Fast</button>
        </div>
        {steps.length > 0 && <span className="algo-progress">{stepIdx + 1} / {steps.length}</span>}
      </div>
      <div className="ds-canvas algo-canvas">
        <div className="bs-array">
          {arr.map((val, i) => {
            let cls = 'bs-cell'
            if (step) {
              if (step.found === i) cls += ' bs-cell-found'
              else if (step.mid === i) cls += ' bs-cell-mid'
              else if (step.low >= 0 && i >= step.low && i <= step.high) cls += ' bs-cell-active'
              else if (step.low >= 0) cls += ' bs-cell-eliminated'
            }
            return <div key={i} className={cls}>{val}</div>
          })}
        </div>
        <div className="bs-pointers">
          {arr.map((_, i) => {
            if (!step || step.low < 0) return <div key={i} className="bs-pointer" />
            const parts = []
            if (step.low === i) parts.push('low')
            if (step.mid === i) parts.push('mid')
            if (step.high === i) parts.push('high')
            return <div key={i} className="bs-pointer">{parts.join(' ')}</div>
          })}
        </div>
        <div className="algo-step-desc">
          {step ? step.desc : 'Enter a target value and click Search'}
        </div>
      </div>
    </div>
  )
}

const GRID_ROWS = 12
const GRID_COLS = 20
const CELL_PX = 24

function createEmptyGrid() {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0))
}

function genPathSteps(grid, start, end, useH) {
  const rows = grid.length, cols = grid[0].length
  const steps = []
  const INF = 1e9
  const g = Array.from({ length: rows }, () => Array(cols).fill(INF))
  const par = Array.from({ length: rows }, () => Array(cols).fill(null))
  const h = (r, c) => useH ? Math.abs(r - end.r) + Math.abs(c - end.c) : 0
  g[start.r][start.c] = 0
  const open = [{ r: start.r, c: start.c }]
  const openSet = new Set([`${start.r},${start.c}`])
  const closedSet = new Set()
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]

  const getPath = (r, c) => {
    const p = new Set()
    let k = `${r},${c}`
    while (k) {
      p.add(k)
      const [cr, cc] = k.split(',').map(Number)
      k = par[cr][cc]
    }
    return p
  }

  while (open.length > 0) {
    open.sort((a, b) => (g[a.r][a.c] + h(a.r, a.c)) - (g[b.r][b.c] + h(b.r, b.c)))
    const cur = open.shift()
    const key = `${cur.r},${cur.c}`
    openSet.delete(key)
    closedSet.add(key)
    const fVal = g[cur.r][cur.c] + h(cur.r, cur.c)
    steps.push({
      open: new Set(openSet),
      closed: new Set(closedSet),
      current: key,
      path: getPath(cur.r, cur.c),
      desc: useH
        ? `Visit (${cur.r},${cur.c}) — f=${fVal}, g=${g[cur.r][cur.c]}, h=${h(cur.r, cur.c)}`
        : `Visit (${cur.r},${cur.c}) — distance = ${g[cur.r][cur.c]}`,
    })
    if (cur.r === end.r && cur.c === end.c) {
      steps.push({
        open: new Set(),
        closed: new Set(closedSet),
        current: null,
        path: getPath(cur.r, cur.c),
        desc: `Path found! Length: ${g[cur.r][cur.c]} steps`,
      })
      return steps
    }
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (grid[nr][nc] === 1 || closedSet.has(`${nr},${nc}`)) continue
      const ng = g[cur.r][cur.c] + 1
      if (ng < g[nr][nc]) {
        g[nr][nc] = ng
        par[nr][nc] = key
        const nk = `${nr},${nc}`
        if (!openSet.has(nk)) {
          open.push({ r: nr, c: nc })
          openSet.add(nk)
        }
      }
    }
  }
  steps.push({
    open: new Set(),
    closed: new Set(closedSet),
    current: null,
    path: new Set(),
    desc: 'No path found!',
  })
  return steps
}

function PathfindViz({ algorithm }) {
  const [grid, setGrid] = useState(createEmptyGrid)
  const [start, setStart] = useState({ r: 5, c: 2 })
  const [end, setEnd] = useState({ r: 5, c: 17 })
  const [mode, setMode] = useState('wall')
  const [steps, setSteps] = useState([])
  const [stepIdx, setStepIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(30)
  const drawingRef = useRef(false)
  const drawActionRef = useRef(null)

  const isRunning = steps.length > 0

  const applyDraw = (r, c) => {
    if (r === start.r && c === start.c) return
    if (r === end.r && c === end.c) return
    setGrid((prev) => {
      const g = prev.map((row) => [...row])
      if (mode === 'wall') g[r][c] = drawActionRef.current
      else if (mode === 'erase') g[r][c] = 0
      return g
    })
  }

  const handleMouseDown = (r, c, e) => {
    e.preventDefault()
    if (isRunning) return
    if (mode === 'start') { if (grid[r][c] !== 1) setStart({ r, c }); return }
    if (mode === 'end') { if (grid[r][c] !== 1) setEnd({ r, c }); return }
    drawingRef.current = true
    if (mode === 'wall') drawActionRef.current = grid[r][c] === 1 ? 0 : 1
    applyDraw(r, c)
  }

  const handleMouseEnter = (r, c) => {
    if (!drawingRef.current || isRunning) return
    applyDraw(r, c)
  }

  const stopDrawing = () => { drawingRef.current = false }

  const run = () => {
    const newSteps = genPathSteps(grid, start, end, algorithm === 'astar')
    setSteps(newSteps)
    setStepIdx(0)
    setPlaying(true)
  }

  const reset = () => { setSteps([]); setStepIdx(-1); setPlaying(false) }

  const clearAll = () => {
    reset()
    setGrid(createEmptyGrid())
    setStart({ r: 5, c: 2 })
    setEnd({ r: 5, c: 17 })
  }

  const togglePlay = () => {
    if (playing) { setPlaying(false); return }
    if (steps.length === 0) return
    if (stepIdx >= steps.length - 1) setStepIdx(0)
    setPlaying(true)
  }

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) { setPlaying(false); return prev }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(timer)
  }, [playing, speed, steps.length])

  const step = stepIdx >= 0 && stepIdx < steps.length ? steps[stepIdx] : null

  return (
    <div className="ds-viz">
      <div className="ds-controls algo-controls">
        <div className="pf-tools">
          {[['wall', 'Wall'], ['start', 'Start'], ['end', 'End'], ['erase', 'Erase']].map(([m, label]) => (
            <button
              key={m}
              type="button"
              className={`ghost ds-btn ds-btn-sm ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              disabled={isRunning}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="ghost ds-btn" onClick={run} disabled={isRunning}>Run</button>
        <button type="button" className="ghost ds-btn" onClick={togglePlay} disabled={!isRunning}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="ghost ds-btn"
          onClick={() => stepIdx < steps.length - 1 && setStepIdx((s) => s + 1)}
          disabled={playing || !isRunning}
        >
          Step
        </button>
        <button type="button" className="ghost ds-btn" onClick={reset} disabled={!isRunning}>Reset</button>
        <button type="button" className="ghost ds-btn" onClick={clearAll}>Clear</button>
        <div className="algo-speed">
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 100 ? 'active' : ''}`} onClick={() => setSpeed(100)}>Slow</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 30 ? 'active' : ''}`} onClick={() => setSpeed(30)}>Normal</button>
          <button type="button" className={`ghost ds-btn ds-btn-sm ${speed === 5 ? 'active' : ''}`} onClick={() => setSpeed(5)}>Fast</button>
        </div>
        {isRunning && <span className="algo-progress">{stepIdx + 1} / {steps.length}</span>}
      </div>
      <div className="ds-canvas algo-canvas">
        <div
          className="pf-grid"
          style={{ gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_PX}px)` }}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        >
          {grid.flatMap((row, r) =>
            row.map((cell, c) => {
              const key = `${r},${c}`
              let cls = 'pf-cell'
              if (cell === 1) cls += ' pf-wall'
              if (step) {
                if (step.closed.has(key)) cls += ' pf-closed'
                if (step.open.has(key)) cls += ' pf-open'
                if (step.path.has(key)) cls += ' pf-path'
                if (step.current === key) cls += ' pf-current'
              }
              if (r === start.r && c === start.c) cls += ' pf-start'
              if (r === end.r && c === end.c) cls += ' pf-end'
              return (
                <div
                  key={key}
                  className={cls}
                  onMouseDown={(e) => handleMouseDown(r, c, e)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                />
              )
            })
          )}
        </div>
        <div className="algo-step-desc">
          {step ? step.desc : 'Draw walls on the grid, then click Run'}
        </div>
      </div>
    </div>
  )
}

function Algorithms({ currentRoute }) {
  const [selected, setSelected] = useState('bubble')

  return (
    <Page
      label="Algorithms"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="ds-page">
        <aside className="sidebar">
          <p className="eyebrow">OCV</p>
          <h4>Algorithms</h4>
          <p className="muted small">Algorithm</p>
          {ALGO_TYPES.map((algo) => (
            <button
              key={algo.id}
              type="button"
              className={`sidebar__item ${selected === algo.id ? 'active' : ''}`}
              onClick={() => setSelected(algo.id)}
            >
              {algo.label}
            </button>
          ))}
        </aside>

        <div className="ds-main">
          <div className="ds-viz-section">
            <div className="ds-viz-header">{ALGO_TYPES.find((a) => a.id === selected)?.label} Visualization</div>
            {selected === 'dijkstra' || selected === 'astar' ? (
              <PathfindViz algorithm={selected} key={selected} />
            ) : selected === 'binary-search' ? (
              <BinarySearchViz key="bs" />
            ) : (
              <SortViz algorithm={selected} key={selected} />
            )}
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

export default Algorithms
