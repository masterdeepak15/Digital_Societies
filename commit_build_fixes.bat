@echo off
setlocal
cd /d "D:\Claude\Society-App\society-app-spec\Digital_Societies"

if exist ".git\index.lock" del /f /q ".git\index.lock"

git add services/DigitalSocieties.Facility/Application/Commands/BookFacilityCommand.cs
git add services/DigitalSocieties.Facility/Application/Queries/GetFacilitiesQuery.cs
git add services/DigitalSocieties.Accounting/Application/Commands/PostLedgerEntryCommand.cs
git add services/DigitalSocieties.Accounting/Application/Commands/ApproveLedgerEntryCommand.cs
git add services/DigitalSocieties.Communication/Infrastructure/Push/ExpoPushChannel.cs
git add services/DigitalSocieties.Identity/Application/Commands/AddFamilyMemberCommand.cs
git add services/DigitalSocieties.Identity/Application/Queries/GetFlatMembersQuery.cs

echo.
echo === Changed files ===
git status --short

echo.
set /p CONFIRM=Commit build fixes? (y/n):
if /i not "%CONFIRM%"=="y" (echo Aborted. & exit /b 1)

git commit -m "fix(build): resolve all CS compile errors from CI

BookFacilityCommand:
- Result<T>.Fail(string) → Fail(code, message) — two-arg form
- _currentUser.Role → IsInRole(\"admin\") — correct ICurrentUser API
- Guid? SocietyId/FlatId/UserId → .Value with null guards
- Add auth context null check at handler entry

PostLedgerEntryCommand:
- Money.FromPaise() → Money.CreateInr(paise/100m) — actual Money API
- Add null guard for SocietyId + UserId; propagate Money.Error on failure

ApproveLedgerEntryCommand / RejectLedgerEntryCommand:
- Result.Fail(string) → Fail(code, message)
- Guid? UserId → .Value with null guard

ExpoPushChannel:
- Implement full INotificationChannel: ChannelName, IsEnabled, SendAsync(NotificationMessage,CT)
- Was using wrong SendAsync(string,string,string?,CT) signature

AddFamilyMemberCommand:
- Result<T>.Fail(string) → Fail(code, message) everywhere
- User.Create(string phone) → PhoneNumber.Create(phone) first, then User.Create(PhoneNumber,name)
- Remove duplicate MemberType class (Shared already has one); use string literal set in validator

GetFlatMembersQuery / GetSocietyMembersQuery:
- Result<T>.Fail(string) → Fail(code, message)

GetFacilitiesQuery (GetAvailableSlotsHandler):
- Result<T>.Fail(string) → Fail(code, message)"

echo.
echo Pushing...
git push origin HEAD
echo Done!
pause
