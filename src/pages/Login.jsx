import Page from '../components/Page'
import { dots } from '../utils'

function Login({ currentRoute }) {
  return (
    <Page
      label="Frame 1"
      title="Login"
      subtitle=""
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

