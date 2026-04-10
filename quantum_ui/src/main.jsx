import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import QuestionsPage from './pages/QuestionsPage.jsx'
import QuestionBuilderPage from './pages/QuestionBuilderPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/questions" element={<QuestionsPage />} />
        <Route path="/builder" element={<QuestionBuilderPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
