import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from '../ui/ToastContainer'
import InstallPrompt from '../ui/InstallPrompt'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <ToastContainer />
      <InstallPrompt />
      <main className="pt-16 pb-20 px-4 max-w-lg mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
