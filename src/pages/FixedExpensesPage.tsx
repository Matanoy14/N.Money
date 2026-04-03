import { Navigate } from 'react-router-dom';

// Redirects to the unified Expenses module — fixed expenses tab
const FixedExpensesPage = () => <Navigate to="/expenses?tab=fixed" replace />;

export default FixedExpensesPage;
