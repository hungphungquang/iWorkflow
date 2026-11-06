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
