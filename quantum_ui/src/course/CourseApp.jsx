import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import App from '../App.jsx';
import QuestionBuilderPage from '../pages/QuestionBuilderPage.jsx';
import QuizCatalogPage from './QuizCatalogPage.jsx';
import CourseQuizPage from './CourseQuizPage.jsx';
import EnrollScreen from './EnrollScreen.jsx';
import { getStudent } from './identity';

// Enrollment guard for the quiz routes only. The visualizer (/) and the circuit
// builder (/builder) are open to everyone; quizzes require a class code. When a
// student isn't enrolled we render the enrollment screen in place; enrolling
// re-renders straight into the requested quiz route.
function RequireEnrollment({ children }) {
  const [student, setStudent] = useState(() => getStudent());
  if (!student) {
    return <EnrollScreen onEnrolled={() => setStudent(getStudent())} />;
  }
  return children;
}

// Root of the course version. Rendered inside <BrowserRouter> in main.jsx.
export default function CourseApp() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/builder" element={<QuestionBuilderPage />} />
      <Route
        path="/quizzes"
        element={<RequireEnrollment><QuizCatalogPage /></RequireEnrollment>}
      />
      <Route
        path="/quiz/:slug"
        element={<RequireEnrollment><CourseQuizPage /></RequireEnrollment>}
      />
    </Routes>
  );
}
