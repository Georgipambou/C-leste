import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function Root(){
  const [themeKey,setThemeKey]=useState(0);
  useEffect(()=>{
    const handler=()=>setThemeKey(k=>k+1);
    window.addEventListener("celeste_theme_changed",handler);
    return()=>window.removeEventListener("celeste_theme_changed",handler);
  },[]);
  return <App key={themeKey}/>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)