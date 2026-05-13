import Page from '../components/Page'
import { dots } from '../utils'

const debuggerSteps = [
  { n: 1, desc: 'Choose language (JavaScript, Python, or C) in the sidebar.' },
  { n: 2, desc: 'Pick a sample from "Sample" or write your own code in the editor.' },
  { n: 3, desc: 'Click Run to start; the execution pauses at the first line.' },
  { n: 4, desc: 'Use Step forward / Step back to move through the code line by line.' },
  { n: 5, desc: 'Watch Variables and Console below to see current values and output.' },
]

const dsSteps = [
  { n: 1, desc: 'Pick a data structure from the sidebar (Stack, Queue, Linked List, etc.).' },
  { n: 2, desc: 'Use the control buttons to perform operations (push, enqueue, insert, …).' },
  { n: 3, desc: 'Watch the animated visualization update in real time.' },
  { n: 4, desc: 'For graphs, run BFS or DFS to see step-by-step traversal highlighting.' },
  { n: 5, desc: 'Review the C implementation displayed alongside the visualization.' },
]

const algoSteps = [
  { n: 1, desc: 'Choose an algorithm from the sidebar (Bubble Sort, Selection Sort, etc.).' },
  { n: 2, desc: 'Click Generate to create a random array, then Play to start the animation.' },
  { n: 3, desc: 'Use Step to advance one operation at a time, or adjust speed (Slow / Normal / Fast).' },
  { n: 4, desc: 'Watch bars swap and highlight as the algorithm compares, swaps, and sorts elements.' },
  { n: 5, desc: 'For Binary Search, enter a target value and observe the divide-and-conquer process.' },
]

function Landing({ currentRoute }) {
  return (
    <Page
      label="Home"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="landing">
        <div className="landing-features">
          <div className="steps-block">
            <div className="steps-title">Debugger</div>
            <div className="steps-subtitle">Step through code line by line and inspect variables</div>
            <div className="steps-grid">
              {debuggerSteps.map((s) => (
                <div key={s.n} className="step-card">
                  <span className="step-num">{s.n}</span>
                  <span className="muted">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="steps-block steps-block-ds">
            <div className="steps-title">Data Structures</div>
            <div className="steps-subtitle">Interactive visualizations of common data structures in C</div>
            <div className="steps-grid">
              {dsSteps.map((s) => (
                <div key={s.n} className="step-card">
                  <span className="step-num">{s.n}</span>
                  <span className="muted">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="steps-block steps-block-algo">
            <div className="steps-title">Algorithms</div>
            <div className="steps-subtitle">Animated sorting and searching algorithm visualizations</div>
            <div className="steps-grid">
              {algoSteps.map((s) => (
                <div key={s.n} className="step-card">
                  <span className="step-num">{s.n}</span>
                  <span className="muted">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

export default Landing
