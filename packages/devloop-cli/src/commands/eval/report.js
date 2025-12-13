
import { reportHandler as reporterReportHandler } from '../../core/eval/reporter.js';

export async function reportHandler(runIdFromArgs, options) {
    // commander passes options as the last argument when there's a positional argument
    await reporterReportHandler(runIdFromArgs, options);
}
