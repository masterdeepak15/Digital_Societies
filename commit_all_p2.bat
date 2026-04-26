@echo off
setlocal

cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"

:: Remove any stale git lock
if exist ".git\index.lock" del /f /q ".git\index.lock"

:: Stage all new + modified files from P2 work
git add services/DigitalSocieties.Accounting/
git add services/DigitalSocieties.Facility/
git add services/DigitalSocieties.Communication/Infrastructure/Push/
git add services/DigitalSocieties.Communication/Infrastructure/Persistence/CommunicationDbContext.cs
git add services/DigitalSocieties.Communication/Infrastructure/CommunicationServiceExtensions.cs
git add services/DigitalSocieties.Identity/Application/Commands/AddFamilyMemberCommand.cs
git add services/DigitalSocieties.Identity/Application/Commands/RemoveMemberCommand.cs
git add services/DigitalSocieties.Identity/Application/Queries/GetFlatMembersQuery.cs
git add services/DigitalSocieties.Identity/Application/Queries/GetSocietyMembersQuery.cs
git add services/DigitalSocieties.Api/Endpoints/Accounting/
git add services/DigitalSocieties.Api/Endpoints/Facility/
git add services/DigitalSocieties.Api/Endpoints/Member/
git add services/DigitalSocieties.Api/Program.cs
git add services/DigitalSocieties.Api/DigitalSocieties.Api.csproj
git add services/DigitalSocieties.Api/Dockerfile
git add services/DigitalSocieties.sln
git add apps/mobile/src/screens/admin/AccountingScreen.tsx
git add apps/mobile/src/screens/admin/MembersScreen.tsx
git add apps/mobile/src/screens/resident/FacilityBookingScreen.tsx
git add DEVELOPMENT_STATUS.md
git add README.md
git add .gitignore

echo.
echo === Staged files ===
git status --short

echo.
set /p CONFIRM=Commit all P2 work? (y/n):
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    exit /b 1
)

git commit -m "feat(p2): Accounting, Facility booking, Push notifications, Family management

Backend (services/)
- DigitalSocieties.Accounting: LedgerEntry aggregate, auto-approval >10k,
  PostLedgerEntryCommand, Approve/Reject commands, GetLedgerEntriesQuery,
  GetMonthlyReportQuery (P&L + category breakdown), AccountingDbContext (schema:accounting),
  EF Core migration + RLS policy
- DigitalSocieties.Facility: Facility + FacilityBooking entities, BookFacilityCommand
  (conflict check + per-flat advance limit), CancelBookingCommand, GetFacilitiesQuery,
  GetMyBookingsQuery, FacilityDbContext (schema:facility), EF Core migration + RLS policies
- Communication: ExpoPushChannel (implements INotificationChannel via Expo Push API),
  PostgresPushTokenStore, IPushTokenStore abstraction, push_tokens table + unique index
- Identity: AddFamilyMemberCommand, RemoveMemberCommand, GetFlatMembersQuery,
  GetSocietyMembersQuery (filterable by role/wing, paginated)
- API: AccountingEndpoints, FacilityEndpoints, MemberEndpoints (push token register/unregister)
- Program.cs: AddAccountingModule, AddFacilityModule wired in
- .csproj + .sln: Accounting + Facility projects added
- Dockerfile: all 9 .csproj COPY lines for optimal layer cache

Mobile (apps/mobile/)
- AccountingScreen (admin): 3-tab layout — P&L report, Ledger entries, Pending approvals
  with add-entry modal (Income/Expense toggle, category chips, dual-approval indicator)
- FacilityBookingScreen (resident): browse facilities, time-slot booking modal,
  upcoming/past booking history with cancel action
- MembersScreen (admin): full rewrite — search, role filter chips, flat-grouped resident
  view (expandable), add-family-member modal, remove member action

Docs
- DEVELOPMENT_STATUS.md: P2 marked complete; new Accounting, Facility, Push, Members tables
- README.md: updated module status column"

echo.
echo Pushing to origin...
git push origin HEAD

echo.
echo Done! All P2 work committed and pushed.
pause
