import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Fieldnotes | Hissho',description:'A focused workspace for Hissho store visit notes',appleWebApp:{capable:true,title:'Fieldnotes',statusBarStyle:'default'}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#f8f8f7'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
