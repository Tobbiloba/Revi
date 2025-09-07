import { Service } from "encore.dev/service";

// Import streaming endpoints to register them
import "./streaming";

export default new Service("sessions");
