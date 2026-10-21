import type { ReactNode } from 'react'
import TopBar from './TopBar'
import './Privacy.css'

export default function Privacy({ account, onHome }: { account: ReactNode; onHome: () => void }) {
  return (
    <div className="screen">
      <TopBar onHome={onHome} account={account} />
      <main className="privacy">
        <h1 className="display">Privacy</h1>
        <p>PinTheCity is a game by Kámán Attila. Questions and requests: contact@pinthecity.me.</p>

        <h2>What is stored</h2>
        <ul>
          <li>
            <b>Account (optional):</b> your email address and whether you confirmed it, a salted
            hash of your password (not the password itself), your best score and your theme and unit
            settings.
          </li>
          <li>
            <b>Google sign-in (optional):</b> if you continue with Google, Google tells us your
            email address, that it's confirmed, and a random account id. We store the id to
            recognise you next time. We don't get your name, photo, contacts or Google password.
          </li>
          <li>
            <b>Email links:</b> when you sign up or ask to reset your password, we email you a
            one-time link. The server keeps only a hash of it, and it stops working after 24 hours
            (confirmation) or 1 hour (password reset).
          </li>
          <li>
            <b>Login:</b> a <code>session</code> cookie for 30 days. The server only keeps a hash of
            it.
          </li>
          <li>
            <b>Guests:</b> a <code>guest_id</code> cookie with a random id for one year, so the
            daily challenge can only be played once.
          </li>
          <li>
            <b>Daily results:</b> which player (account or guest id) played on which day, and the
            score. The histogram only counts how many players landed in each score range.
          </li>
          <li>
            <b>Abuse protection:</b> a hash of your IP address combined with a secret and the date,
            to count at most 3 guest results per address per day. It can't be turned back into your
            IP address without our secret key, and it changes every day.
          </li>
          <li>
            <b>Login protection:</b> to stop password guessing and email spam, we count recent
            attempts to log in, sign up or reset a password, using a salted hash of your IP address
            or the email address you typed. After too many attempts you have to wait a few minutes.
          </li>
          <li>
            <b>Only in your browser:</b> your theme and unit settings.
          </li>
        </ul>
        <p>These cookies are needed for the game to work. There is no tracking or analytics.</p>

        <h2>How long it is kept</h2>
        <p>Old data is deleted automatically once a day.</p>
        <ul>
          <li>
            <b>Account:</b> until you delete it. Your daily results are deleted together with the
            account.
          </li>
          <li>
            <b>Login sessions:</b> until you log out, or at most 30 days.
          </li>
          <li>
            <b>Email links:</b> until they are used or expire (24 hours or 1 hour).
          </li>
          <li>
            <b>Guest daily results:</b> 14 days.
          </li>
          <li>
            <b>Freeplay games:</b> 24 hours.
          </li>
          <li>
            <b>IP address hashes:</b> 2 days.
          </li>
          <li>
            <b>Login protection counters:</b> 1 day.
          </li>
          <li>
            <b>Score histogram:</b> kept, but it only holds counts, nothing about you.
          </li>
        </ul>

        <h2>Who else is involved</h2>
        <ul>
          <li>
            <b>Cloudflare</b> hosts the website and database, and processes every request, including
            your IP address.
          </li>
          <li>
            <b>OpenFreeMap</b> serves the map, so your browser connects to its servers when the map
            loads.
          </li>
          <li>
            <b>Resend</b> delivers our account emails (address confirmation and password reset), so
            it receives your email address and the email's content. We send no newsletters or ads.
          </li>
          <li>
            <b>Google</b> handles the sign-in when you choose <b>Continue with Google</b>. Google's
            own privacy policy applies to that step.
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can delete your account at any time with the <b>Delete account</b> button in the
          account menu (top right). This removes your email, password hash, Google account id, best
          score, settings and daily results straight away. You can also ask to see or delete your
          data by emailing the creator. Logging out ends your session, and deleting this site's
          cookies removes your guest id from your browser.
        </p>
      </main>
    </div>
  )
}
