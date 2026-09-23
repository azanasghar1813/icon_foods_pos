import { kitchenTicketGeneratorService } from './src/services/kitchenTicketGeneratorService.js';
const val = kitchenTicketGeneratorService.generateTickets();
console.log(Array.isArray(val), val);
