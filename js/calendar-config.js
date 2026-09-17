/* Föreningshuset — inställningar för bokningskalendern.
   Kalendern hämtas direkt från Google Calendar API i webbläsaren
   (ingen server behövs), men det kräver en gratis API-nyckel.

   Så skapar du en API-nyckel:
   1. Gå till https://console.cloud.google.com/ och skapa ett nytt projekt
      (eller använd ett befintligt).
   2. Sök upp "Google Calendar API" under "APIs & Services" och klicka Enable.
   3. Gå till "Credentials" → "Create credentials" → "API key".
   4. Klicka på nyckeln → under "API restrictions" välj "Restrict key" och
      kryssa endast i "Google Calendar API".
   5. Under "Application restrictions" välj "Websites" och lägg till er
      domän, t.ex. foreningshusetystad.se/* (och gärna localhost/* medan
      ni testar).
   6. Klistra in nyckeln nedan.

   Kalendern måste vara publik (Inställningar och delning → "Gör
   tillgänglig för allmänheten") för att detta ska fungera. */

const FH_CALENDAR_ID = 'ac3c569cb520c3c1bdeb46136150e99a198a51f80e4205cf93df6d7580794d02@group.calendar.google.com';
const FH_CALENDAR_API_KEY = 'AIzaSyBLeCdsruP1En1EZJnQ7_R_F6OlavGV4hk';
