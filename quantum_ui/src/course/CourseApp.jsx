import { Routes, Route } from 'react-router-dom';
import App from '../App.jsx';
import QuizCatalogPage from './QuizCatalogPage.jsx';
import CourseQuizPage from './CourseQuizPage.jsx';

// Root of the course version. Rendered inside <BrowserRouter> in main.jsx.
// The identity gate (Phase 3) will wrap these routes once it exists.
export default function CourseApp() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/quizzes" element={<QuizCatalogPage />} />
      <Route path="/quiz/:slug" element={<CourseQuizPage />} />
    </Routes>
  );
}
