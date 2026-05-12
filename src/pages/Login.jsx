import Page from '../components/Page'
import { dots } from '../utils'

function Login({ currentRoute }) {
  return (
    <Page
      label="Login"
      title="OCV"
      subtitle="Online Code Visualizer"
      topExtra={dots(3)}
      currentRoute={currentRoute}
    >
      <div className="login-card">
        <label>
          First name
          <input type="text" />
        </label>
        <label>
          Last name
          <input type="text" />
        </label>
        <label>
          Password
          <input type="password" />
        </label>
        <button type="button">Submit</button>
      </div>
    </Page>
  )
}

export default Login

