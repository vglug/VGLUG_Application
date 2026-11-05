import { Suspense, lazy } from 'react'
import { Outlet, RouterProvider, createBrowserRouter, useParams } from 'react-router-dom'
import { Loading } from './components/States'
import { AuthProvider } from './context/AuthContext'
import { SiteProvider } from './context/SiteContext'
import DetailPage from './pages/public/DetailPage'
import HomePage from './pages/public/HomePage'
import InfoPage from './pages/public/InfoPage'
import ListingPage from './pages/public/ListingPage'
import PublicLayout from './pages/public/PublicLayout'
import { ConfirmSubscription, NotFoundPage, Unsubscribe } from './pages/public/StatusPages'

// Admin code is split into its own bundle so public visitors never download it.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const LoginPage = lazy(() => import('./pages/admin/AuthPages').then((m) => ({ default: m.LoginPage })))
const ChangePasswordPage = lazy(() => import('./pages/admin/AuthPages').then((m) => ({ default: m.ChangePasswordPage })))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const ContentList = lazy(() => import('./pages/admin/ContentList'))
const ContentEditor = lazy(() => import('./pages/admin/ContentEditor'))
const PagesList = lazy(() => import('./pages/admin/PagesAdmin').then((m) => ({ default: m.PagesList })))
const PageEditor = lazy(() => import('./pages/admin/PagesAdmin').then((m) => ({ default: m.PageEditor })))
const NavigationSettings = lazy(() => import('./pages/admin/SiteSettings').then((m) => ({ default: m.NavigationSettings })))
const FooterSettings = lazy(() => import('./pages/admin/SiteSettings').then((m) => ({ default: m.FooterSettings })))
const CommentsAdmin = lazy(() => import('./pages/admin/Community').then((m) => ({ default: m.CommentsAdmin })))
const MediaLibrary = lazy(() => import('./pages/admin/Community').then((m) => ({ default: m.MediaLibrary })))
const Subscribers = lazy(() => import('./pages/admin/Community').then((m) => ({ default: m.Subscribers })))

function AdminRoot() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="login-page"><Loading /></div>}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  )
}

// Remount editors when switching between items of the same route.
function KeyedEditor() {
  const { type, id } = useParams()
  return <ContentEditor key={`${type}-${id}`} />
}

function KeyedList() {
  const { type } = useParams()
  return <ContentList key={type} />
}

function KeyedPageEditor() {
  const { key } = useParams()
  return <PageEditor key={key} />
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/about', element: <InfoPage key="about" pageKey="about" /> },
      { path: '/join', element: <InfoPage key="join" pageKey="join" /> },
      { path: '/contact', element: <InfoPage key="contact" pageKey="contact" /> },
      { path: '/meetups', element: <ListingPage key="meetup" type="meetup" /> },
      { path: '/events', element: <ListingPage key="event" type="event" /> },
      { path: '/blogs', element: <ListingPage key="blog" type="blog" /> },
      { path: '/meetups/:ref', element: <DetailPage type="meetup" /> },
      { path: '/events/:ref', element: <DetailPage type="event" /> },
      { path: '/blogs/:ref', element: <DetailPage type="blog" /> },
      { path: '/subscribe/confirm', element: <ConfirmSubscription /> },
      { path: '/unsubscribe', element: <Unsubscribe /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminRoot />,
    children: [
      { path: 'login', element: <LoginPage /> },
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'password', element: <ChangePasswordPage /> },
          { path: 'content/:type', element: <KeyedList /> },
          { path: 'content/:type/:id', element: <KeyedEditor /> },
          { path: 'pages', element: <PagesList /> },
          { path: 'pages/:key', element: <KeyedPageEditor /> },
          { path: 'navigation', element: <NavigationSettings /> },
          { path: 'footer', element: <FooterSettings /> },
          { path: 'comments', element: <CommentsAdmin /> },
          { path: 'media', element: <MediaLibrary /> },
          { path: 'subscribers', element: <Subscribers /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <SiteProvider>
      <RouterProvider router={router} />
    </SiteProvider>
  )
}
