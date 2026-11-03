import { Route, Switch } from "wouter";
import Protected from "./_core/Protected";
import { ToastProvider } from "@/components/ui/toast";

// Public site
import Home from "./pages/Home";
import About from "./pages/About";
import Solutions from "./pages/Solutions";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Account from "./pages/Account";

// Business app
import AppLayout from "./pages/app/AppLayout";
import Onboarding from "./pages/app/Onboarding";
import Overview from "./pages/app/Overview";
import Sales from "./pages/app/Sales";
import Pos from "./pages/app/POS";
import Inventory from "./pages/app/Inventory";
import Purchases from "./pages/app/Purchases";
import Orders from "./pages/app/Orders";
import Customers from "./pages/app/Customers";
import Suppliers from "./pages/app/Suppliers";
import Expenses from "./pages/app/Expenses";
import Finance from "./pages/app/Finance";
import Employees from "./pages/app/Employees";
import Reports from "./pages/app/Reports";
import Analytics from "./pages/app/Analytics";
import Advisor from "./pages/app/Advisor";
import Debts from "./pages/app/Debts";
import Notifications from "./pages/app/Notifications";
import Settings from "./pages/app/Settings";
import Branches from "./pages/app/Branches";

// Super admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminSettings from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <ToastProvider>
      <Switch>
        {/* Public */}
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/solutions" component={Solutions} />
        <Route path="/features" component={Features} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/contact" component={Contact} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Signup} />
        <Route path="/account">
          <Protected>
            <Account />
          </Protected>
        </Route>

        {/* Business app */}
        <Route path="/app/onboarding">
          <Protected>
            <Onboarding />
          </Protected>
        </Route>
        <Route path="/app/pos">
          <Protected>
            <AppLayout>
              <Pos />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/sales">
          <Protected>
            <AppLayout>
              <Sales />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/inventory">
          <Protected>
            <AppLayout>
              <Inventory />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/purchases">
          <Protected>
            <AppLayout>
              <Purchases />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/orders">
          <Protected>
            <AppLayout>
              <Orders />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/customers">
          <Protected>
            <AppLayout>
              <Customers />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/suppliers">
          <Protected>
            <AppLayout>
              <Suppliers />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/expenses">
          <Protected>
            <AppLayout>
              <Expenses />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/finance">
          <Protected>
            <AppLayout>
              <Finance />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/employees">
          <Protected>
            <AppLayout>
              <Employees />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/reports">
          <Protected>
            <AppLayout>
              <Reports />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/analytics">
          <Protected>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/advisor">
          <Protected>
            <AppLayout>
              <Advisor />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/debts">
          <Protected>
            <AppLayout>
              <Debts />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/notifications">
          <Protected>
            <AppLayout>
              <Notifications />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/settings">
          <Protected>
            <AppLayout>
              <Settings />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app/branches">
          <Protected>
            <AppLayout>
              <Branches />
            </AppLayout>
          </Protected>
        </Route>
        <Route path="/app">
          <Protected>
            <AppLayout>
              <Overview />
            </AppLayout>
          </Protected>
        </Route>

        {/* Super admin */}
        <Route path="/admin/businesses">
          <Protected>
            <AdminLayout>
              <AdminBusinesses />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/users">
          <Protected>
            <AdminLayout>
              <AdminUsers />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/subscriptions">
          <Protected>
            <AdminLayout>
              <AdminSubscriptions />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/payments">
          <Protected>
            <AdminLayout>
              <AdminPayments />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/support">
          <Protected>
            <AdminLayout>
              <AdminSupport />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/audit">
          <Protected>
            <AdminLayout>
              <AdminAudit />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin/settings">
          <Protected>
            <AdminLayout>
              <AdminSettings />
            </AdminLayout>
          </Protected>
        </Route>
        <Route path="/admin">
          <Protected>
            <AdminLayout>
              <AdminOverview />
            </AdminLayout>
          </Protected>
        </Route>

        <Route>
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-5xl font-bold text-primary">404</p>
            <p className="text-muted-foreground">This page could not be found.</p>
            <a href="/" className="text-sm font-medium text-primary hover:underline">
              Back to home
            </a>
          </div>
        </Route>
      </Switch>
    </ToastProvider>
  );
}
