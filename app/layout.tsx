import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Core Grid Africa | Digital infrastructure for African businesses', description: 'Core Grid Africa builds digital infrastructure that powers African businesses. Meet BizPilot.' }
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
