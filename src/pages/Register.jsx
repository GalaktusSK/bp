import Page from '../components/Page'
import { dots } from '../utils'

function Register({ currentRoute }) {
  return (
    <Page
      label="Register"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="login-card">
        <label>
          Full name
          <input type="text" />
        </label>
        <label>
          Email
          <input type="email" />
        </label>
        <label>
          Password
          <input type="password" />
        </label>
        <label>
          Confirm Password
          <input type="password" />
        </label>
        <button type="button">Create account</button>
      </div>
    </Page>
  )
}

export default Register

