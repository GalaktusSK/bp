import Page from '../components/Page'
import { dots } from '../utils'

const steps = [
  { n: 1, title: 'Step 1', desc: 'Choose language on the left (3 options).' },
  { n: 2, title: 'Step 2', desc: 'Write your program in the text field.' },
  { n: 3, title: 'Step 3', desc: 'Click run code under the text field.' },
  { n: 4, title: 'Step 4', desc: 'Step through the code with forward/back.' },
  { n: 5, title: 'Step 5', desc: 'Discover additional features.' },
  { n: 6, title: 'Step 6', desc: 'When done, send us feedback.' },
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

