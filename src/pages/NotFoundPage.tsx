import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page-content not-found-page">
      <p className="eyebrow">404 — NOT FOUND</p>
      <h1>That page went<br /><span className="accent-text">off the feed.</span></h1>
      <Link className="primary-button" to="/">Back to Home</Link>
    </div>
  )
}
