import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import CreatePage from './pages/CreatePage'
import DiscoverPage from './pages/DiscoverPage'
import HomePage from './pages/HomePage'
import MessagesPage from './pages/MessagesPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import ShortsPage from './pages/ShortsPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import AuthPage from './pages/AuthPage'

export default function App() {
  return (
    <Routes>
      <Route path="sign-in" element={<AuthPage initialMode="sign-in" />} />
      <Route path="sign-up" element={<AuthPage initialMode="sign-up" />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="shorts" element={<ShortsPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
