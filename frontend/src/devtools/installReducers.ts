import { injectReducers } from "../store";
import APIKeyReducer from "../slices/apiKey/reducer";
import CalendarReducer from "../slices/calendar/reducer";
import chatReducer from "../slices/chat/reducer";
import CrmReducer from "../slices/crm/reducer";
import CryptoReducer from "../slices/crypto/reducer";
import DashboardAnalyticsReducer from "../slices/dashboardAnalytics/reducer";
import DashboardCRMReducer from "../slices/dashboardCRM/reducer";
import DashboardCryptoReducer from "../slices/dashboardCrypto/reducer";
import DashboardNFTReducer from "../slices/dashboardNFT/reducer";
import DashboardProjectReducer from "../slices/dashboardProject/reducer";
import EcommerceReducer from "../slices/ecommerce/reducer";
import FileManagerReducer from "../slices/fileManager/reducer";
import InvoiceReducer from "../slices/invoice/reducer";
import JobReducer from "../slices/jobs/reducer";
import MailboxReducer from "../slices/mailbox/reducer";
import ProjectsReducer from "../slices/projects/reducer";
import TasksReducer from "../slices/tasks/reducer";
import TeamDataReducer from "../slices/team/reducer";
import TicketsReducer from "../slices/tickets/reducer";
import TodosReducer from "../slices/todos/reducer";

let installed = false;

export const installDevtoolReducers = () => {
  if (installed) return;

  injectReducers({
    APIKey: APIKeyReducer,
    Calendar: CalendarReducer,
    Chat: chatReducer,
    Crm: CrmReducer,
    Crypto: CryptoReducer,
    DashboardAnalytics: DashboardAnalyticsReducer,
    DashboardCRM: DashboardCRMReducer,
    DashboardCrypto: DashboardCryptoReducer,
    DashboardNFT: DashboardNFTReducer,
    DashboardProject: DashboardProjectReducer,
    Ecommerce: EcommerceReducer,
    FileManager: FileManagerReducer,
    Invoice: InvoiceReducer,
    Jobs: JobReducer,
    Mailbox: MailboxReducer,
    Projects: ProjectsReducer,
    Tasks: TasksReducer,
    Team: TeamDataReducer,
    Tickets: TicketsReducer,
    Todos: TodosReducer,
  });

  installed = true;
};
