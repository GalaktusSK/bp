import Page from '../components/Page'
import { dots } from '../utils'

function Contact({ currentRoute }) {
  return (
    <Page
      label="Contact"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="contact">
        <form className="form-card">
          <label>
            Full name
            <input type="text" />
          </label>
          <label>
            Email
            <input type="email" />
          </label>
          <label>
            Subject
            <input type="text" />
          </label>
          <label>
            Message
            <textarea rows="4"></textarea>
          </label>
          <button type="button">Send</button>
        </form>
      </div>
    </Page>
  )
}

export default Contact

