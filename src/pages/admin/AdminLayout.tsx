import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLayout() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-white">SafeHer Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <NavLink to="/" className="text-xs text-gray-400 hover:text-white">← Back to App</NavLink>
          <button onClick={signOut} className="text-xs text-red-400 hover:text-red-300">Sign Out</button>
        </div>
      </header>

      <div className="flex">
        <nav className="w-48 bg-gray-800 min-h-screen border-r border-gray-700 p-4 flex flex-col gap-1">
          {[
            { to: '/admin/dashboard', icon: '📡', label: 'Live SOS Feed' },
            { to: '/admin/analytics', icon: '📊', label: 'Analytics' },
            { to: '/admin/settings', icon: '⚙️', label: 'Settings' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-6 max-w-5xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
