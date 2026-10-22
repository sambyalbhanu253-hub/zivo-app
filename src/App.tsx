import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import CreatePage from './pages/CreatePage'
import DiscoverPage from './pages/DiscoverPage'
import EditChannelPage from './pages/EditChannelPage'
import HomePage from './pages/HomePage'
import MessagesPage from './pages/MessagesPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import ProfileSectionPage from './pages/ProfileSectionPage'
import ShortsPage from './pages/ShortsPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import WatchPage from './pages/WatchPage'

export default function App() {
  return (
    <Routes>
      <Route path="sign-in" element={<Navigate to="/" replace />} />
      <Route path="sign-up" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="watch/:videoId" element={<WatchPage />} />
        <Route path="shorts" element={<ShortsPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/edit-channel" element={<EditChannelPage />} />
        <Route path="profile/:section" element={<ProfileSectionPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
