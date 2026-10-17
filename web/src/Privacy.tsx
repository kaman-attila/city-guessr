import type { ReactNode } from 'react'
import TopBar from './TopBar'
import './Privacy.css'

export default function Privacy({ account, onHome }: { account: ReactNode; onHome: () => void }) {
  return (
    <div className="screen">
      <TopBar onHome={onHome} account={account} />
      <main className="privacy">
        <h1 className="display">Privacy</h1>
        <p>CityGuessr is a game by Kámán Attila. Questions and requests: kmnttl@gmail.com.</p>

        <h2>What is stored</h2>
        <ul>
          <li>
            <b>Account (optional):</b> your email address, a salted hash of your password (not the
            password itself), your best score and your theme and unit settings.
          </li>
          <li>
            <b>Login:</b> a <code>session</code> cookie for 30 days. The server only keeps a hash of it.
          </li>
          <li>
            <b>Guests:</b> a <code>guest_id</code> cookie with a random id for one year, so the daily
            challenge can only be played once.
          </li>
          <li>
            <b>Daily results:</b> which player (account or guest id) played on which day, and the score.
            The histogram only counts how many players landed in each score range.
          </li>
          <li>
            <b>Abuse protection:</b> a hash of your IP address combined with a secret and the date, to
            count at most 3 guest results per address per day. It can't be turned back into your IP
            address, and it changes every day.
          </li>
          <li>
            <b>Only in your browser:</b> your theme and unit settings.
          </li>
        </ul>
        <p>These cookies are needed for the game to work. There is no tracking or analytics.</p>

        <h2>Who else is involved</h2>
        <ul>
          <li>
            <b>Cloudflare</b> hosts the website and database, and processes every request, including your
            IP address.
          </li>
          <li>
            <b>OpenFreeMap</b> serves the map, so your browser connects to its servers when the map loads.
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can ask to see or delete your data at any time by emailing the creator. Logging out ends
          your session, and deleting this site's cookies removes your guest id from your browser.
        </p>
      </main>
    </div>
  )
}