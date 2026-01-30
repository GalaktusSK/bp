import Page from '../components/Page'
import { dots } from '../utils'

const steps = [
  { n: 1, title: 'Step 1', desc: 'In the Debugger, choose language (JavaScript, Python, or C) in the sidebar.' },
  { n: 2, title: 'Step 2', desc: 'Pick a sample from "Ukážka" or write your own code in the editor.' },
  { n: 3, title: 'Step 3', desc: 'Click Run to start; for JavaScript and Python, the execution pauses at the first line.' },
  { n: 4, title: 'Step 4', desc: 'Use Step forward and Step back to move through the code line by line (JavaScript and Python).' },
  { n: 5, title: 'Step 5', desc: 'Watch Variables and Console below to see current values and output.' },
  { n: 6, title: 'Step 6', desc: 'When the program ends, "Program ukončený" is shown in the console.' },
]

function Landing({ currentRoute }) {
  return (
    <Page
      label="Landing page"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="landing">
        <div className="steps-block">
          <div className="steps-title">How to use?</div>
          <div className="steps-grid">
            {steps.map((s) => (
              <div key={s.n} className="step-card">
                <span className="step-num">{s.n}</span>
                <strong>{s.title}</strong>
                <span className="muted">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

export default Landing

