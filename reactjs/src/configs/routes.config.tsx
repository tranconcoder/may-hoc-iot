import { createBrowserRouter } from 'react-router-dom';
import BoxLayout from '../components/layouts/BoxLayout';
import AddUserPage from '../pages/AddUser';
import ChartPage from '../pages/Chart';

// Pages
import DashboardPage from '../pages/Dashboard/index.page';
import LoginPage from '../pages/LoginPage';

const router = createBrowserRouter([
	{
		path: '*',
		element: <h1>404, Not found!</h1>,
	},
	{
		path: '',
		element: <BoxLayout />,
		children: [
			{
				path: '/',
				element: <DashboardPage />,
			},
			{
				path: '/chart',
				element: <ChartPage />,
			},
			{
				path: '/add-user',
				element: <AddUserPage />,
			},
			{
				path: '/login',
				element: <LoginPage />,
			},
		],
	},
]);

export default router;
