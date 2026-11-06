This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Working Standard

Both the queue and dashboard follow the header's VI/EN language switch, including statuses, filters, column sorting, form validation, and date/number formatting. Case titles, department names, comments, filenames, and stored history remain as entered. Shared labels are in `src/lib/i18n-working-standard.ts`.

The workspace lists each parent case once and opens the department approval table by default. Displayed case approval status is `Completed` only when all required `RelSecWS` reviews are completed; otherwise it is `In Progress`, including cancelled or missing review data. Approval completion is deliberately separate from the raw Activiti parent workflow state: all reviews can be completed while later parent workflow steps still run. Production data remains read-only. Per-department details and demo actions open only when a department is selected.

The main dashboard counts parent cases, not department review instances. Its status donut partitions cases into `In Progress` and `Completed`; these sum to the case cohort total. Overdue cases are a subset of in-progress cases, not an additional status. Case completion percentage requires all departments, even when filtering to one department. The department table and stacked department chart count related parent cases; cases may occur in multiple department rows, so row totals must not be summed. The chart displays all departments in descending case volume, with green Completed and amber In Progress segments. Its labels, totals, and segments link to the matching case list while preserving the selected period and data source.

Open `/working-standard/dashboard` from the dashboard sidebar or company dashboard chart. Open the review queue at `/working-standard` from the work sidebar, the `RelSecWS` definition, or dashboard drilldowns.

The dashboard supports rolling 3/6/12-month cohorts based on actual parent creation dates. Completion percentage, backlog, overdue, aging, and monthly charts use that same parent cohort. Lead time runs from parent creation to completion of the final department review. Parent progress includes all historical child reviews, not just recently created children. The unfiltered case workspace also exposes older parents in the snapshot. All dashboard links preserve source, period, status, and department filters; a `parent` parameter selects a case, while `review` selects a department inside it and `reviewStatus` filters cases by child-review status without changing overall case status.

- Production mode requires `IW_DATA_SOURCE=prod` on the server. `NEXT_PUBLIC_IW_DATA_SOURCE=prod` selects it by default. It reuses the existing database configuration and pgpass credentials; no credentials are sent to the browser.
- The read-only snapshot includes `RelSecWS` instances started in the last 12 months and all older unfinished instances. Counts distinguish department review instances from distinct parent process instances. Parent references use `super_process_instance_id_`; department rows use `dataLoopPath` from the parent form.
- The 2,246 figure is the fixed 2026-11-03 survey count, not the current snapshot total. A finished process is not necessarily an approval; cancelled instances are shown separately.
- Production processing remains on the existing iWorkflow system. The snapshot and attachment endpoints only read the database. As with the existing 4M preview, this is an internal preview, not a separately authenticated production portal.
- Demo mode uses fictional records saved under `iw.working-standard.v1` in browser storage, separately from production. Select the demo actor to test manager approval or assignment, staff confirmation, and manager recheck/reassignment. These transitions follow the latest production `RelSecWS` BPMN (version 12, verified 2026-11-05); each new task has a two-day deadline. There is no rejection branch in this workflow.

Run the focused checks with `npm run test:working-standard`, then `npm run lint` and `npm run build`.

## Operational Request Form

`Operational_Request_Form` is the busiest workflow: about 1,050 requests started per year, and more than 3,000 are still open. It moves goods (finished tires) between the requesting section, 3312-PIC and the Yusen finished-goods warehouse. The workspace at `/operational-request` and the dashboard at `/operational-request/dashboard` follow the same VI/EN switch, source toggle and read-only production rules as Working Standard. Shared labels are in `src/lib/i18n-operational-request.ts`.

Each request goes through 8 BPMN steps: PIC request → request approval → 3312-PIC receipt → Yusen WH receipt (warehouse confirmation required) → PIC result (total/OK/NG, NG handling) → result approval → 3312-PIC confirmation → Yusen WH confirmation. Approvers can approve, request a revision (back to the request or result step) or reject (the reject service task). Revise and reject need a comment. A request is `Cancelled` when the process ended with a delete reason, and `Rejected` when it passed through the reject service task.

- The snapshot covers requests started in the last 12 months plus all older unfinished ones (1 read-only transaction). The section comes from the request code prefix (`FI-2026-…` → `FI`). The legacy eForm button in `user_action` sets the decision (`P4M_Button_PD` approve, `P4M_Button_TC` reject, `P4M_Button_YCCS` revise). `ORF_Barcode` can be a Java-serialized `longString`. The snapshot keeps the first 40 barcode lines, so search only covers those. The detail view loads the full list from `/api/operational-request/barcodes/[id]`.
- Most of the backlog is stuck at "PIC confirms result". `Stale` means open with no task activity for more than 365 days, the same definition as the abandoned-instances report. Overdue and stale are calculated from the snapshot time.
- The dashboard cohort (3/6/12 months) drives the status donut, monthly trend, completion rate and average lead time. The KPI cards, donut and section table separate open requests into on-time and overdue, so completed + on time + overdue + rejected/cancelled always equals requests started. Backlog by step, aging, the section table's backlog column and the approver chart cover every open request regardless of start date. Links open the workspace with `source`, `status`, `stage`, `department`, `since`, `assignee` or `request` parameters.
- Demo mode stores fictional requests in `iw.operational-request.v1` in browser storage. Use the actor selector to test each step: creating and resubmitting requests, approving, revising, rejecting, receiving, and entering results. New codes continue the `<SECTION>-<year>-NNN` sequence. Step deadlines are 2 days, or 3 days for the receipt steps.

Run the focused checks with `npm run test:operational-request`, then `npm run lint` and `npm run build`.

## Request Providing Company Uniform

`Uniform_Request` handles requests to issue or exchange company uniforms and PPE (shirts, pants, cap, Jogger and Simon shoes). About 870 requests are started per year, and more than 2,200 are still open. The workspace at `/uniform-request` and the dashboard at `/uniform-request/dashboard` follow the same VI/EN switch, source toggle and read-only production rules as Working Standard. Shared labels are in `src/lib/i18n-uniform-request.ts`.

The current BPMN (v11) has up to 6 steps: requester → direct supervisor (only for the sections listed in `UNIFORM_SUPERVISOR_SECTIONS`) → section manager → GA PIC check (candidate group `iw_ga`) → GA manager → requester confirms receipt. Approvers can approve, request a revision (back to the requester) or reject. Revise and reject need a comment. Older versions also had GM and GA general manager steps. Their task keys map to the `gm` and `gaGeneral` legacy steps, which only show up in filters and charts while cases still wait there.

- The snapshot covers requests started in the last 12 months plus all older unfinished ones (1 read-only transaction). The 10 garment rows come from the eForm variables (`Re_*` returned, `New_*` issued, keeping the original typos such as `New_TShirt_Short_Siz`). Only filled rows are kept, and free-text quantities are summed when they are numeric. The legacy eForm button in `user_action` sets the decision, and missing buttons are inferred from the next step. A request is `Cancelled` when the process ended with a delete reason, and `Rejected` when it passed through the reject service task.
- Most of the backlog waits at "requester confirms receipt", and several hundred drafts at the request step were never submitted. `Stale` means open with no task activity for more than 365 days. Overdue and stale are calculated from the snapshot time.
- The dashboard cohort (3/6/12 months) drives the status donut, monthly trend, request types, item demand (rejected and cancelled requests excluded), completion rate and average lead time. Backlog by step, aging, the section table's backlog column and the approver chart cover every open request regardless of start date.
- Demo mode stores fictional requests in `iw.uniform-request.v1` in browser storage. Use the actor selector to test each step: creating and resubmitting requests, approving, revising, rejecting, GA confirmation and receipt confirmation. New codes continue the `<SECTION>-<year>-NNN` sequence. Step deadlines are 2 days.

Run the focused checks with `npm run test:uniform-request`, then `npm run lint` and `npm run build`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
