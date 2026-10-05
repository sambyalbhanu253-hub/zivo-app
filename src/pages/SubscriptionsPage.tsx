import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function SubscriptionsPage() {
  return (
    <div className="page-content">
      <section className="page-intro">
        <p className="eyebrow">YOUR CREATOR CIRCLE</p>
        <h1>Stay close<br /><span className="accent-text">to the ones you love.</span></h1>
        <p className="page-description">Follow creators to find their latest videos here.</p>
      </section>
      <section className="feature-card discover-card">
        <span className="feature-icon"><Icon name="discover" size={24} /></span>
        <h2>Your subscriptions start here</h2>
        <p>Explore the community and follow creators to build a feed that feels like yours.</p>
        <Link className="text-link" to="/discover">Find creators <Icon name="arrow" size={16} /></Link>
      </section>
    </div>
  )
}
