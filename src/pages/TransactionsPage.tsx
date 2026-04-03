import { Navigate } from 'react-router-dom';

// Redirects to the unified Expenses module — variable expenses tab
const TransactionsPage = () => <Navigate to="/expenses?tab=variable" replace />;

export default TransactionsPage;
