-   Signup: add current address or at least high school state
-   Signup: College Year should be dropdown
-   bug when inviting to chat (mot anymore?)
-   21 per page instead of 20?
-   Signup: city/zipcode should be tied
-   Matches: Improve text when no matches (current: "No matches found yet. Make sure your profile and compatibility answers are filled out")
-   Add user name in chat messages
-   Add reject/block so users can't see users who rejected/blocked them
-   Moderation;
    -   Chat, login info (name, etc...), chat room names
-   Show participants and pending invitees in chat room
-   Show owner and participants in chat cards
-   See messages from before joining the room?

Features - Todo:

-   Profile detail page with Last text question if answered and common questions answers.
-   Remove from matches from Matches cards and when removing from shortlist
-   Store profile/photos/avatars instead of url
-   Ability to remove answer
-   Share with docker
-   Add Compatibility questions
-   Kick from room
-   User settings
-   Notifications
-   Add users from chatroom.
-   Remove or disable "Start Chat button" from cards and shortlist when already owning a room (Keep "Add to ")
-   View password
-   Photo hosting + instagram integration
-   Security: Backend secrets, user data, age verification
-   Text moderation
-   Add filters to matches (and shortlist?) page(s)
-   Search, filter, sort matches and shortlist

Tests - Todo:

-   Login (positive and negative)
-   Matches, Shortlist, chatrooms, chat empty states

npx prisma migrate dev --name add_question_category

### Regenerate Prisma Client (usually automatic)

`migrate dev` already does this, but if you ever need it explicitly:

`npx prisma generate`

### Where you are right now (and it’s solid)

You’ve successfully:

-   Extended profile data in a forward-compatible way
    
-   Propagated avatar info through **matches**, **chat**, and **profile**
    
-   Handled browser hotlink failures gracefully
    
-   Avoided premature complexity
    

That’s exactly how good MVPs are built.

---

### Natural next directions (pick one when ready)

From here, the highest-value next steps are:

1.  **UX polish**
    
    -   Match cards layout improvements
        
    -   Empty states (no matches / no chats)
        
    -   Loading skeletons instead of spinners
        
2.  **Functional completeness**
    
    -   Invite additional users to chat from chat page (option 2 you mentioned earlier)
        
    -   Leave / kick user flows with confirmations
        
    -   Chat unread indicator in navbar
        
3.  **Data correctness**
    
    -   Match score explanation (“Why am I seeing this person?”)
        
    -   Compatibility completion nudges (banner if <20%)
        
    -   Prevent users in 3 rooms from appearing in matches (you defined this earlier)
        
4.  **Foundations for scale**
    
    -   Centralized DTO types shared between frontend/backend
        
    -   Pagination for matches & messages
        
    -   Replace polling with WebSockets later (you’re well positioned for it)
        
    -     
        

curl.exe ^"http://localhost:4000/compatibility/answers^" ^

  -X PUT ^

  -H ^"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0^" ^

  -H ^"Accept: */*^" ^

  -H ^"Accept-Language: en-US,en;q=0.5^" ^

  -H ^"Accept-Encoding: gzip, deflate, br, zstd^" ^

  -H ^"Referer: [http://localhost:3000/^"](http://localhost:3000/^ "http://localhost:3000/^") ^

  -H ^"Content-Type: application/json^" ^

  -H ^"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhYmYyOWFiZi03YTRhLTRiZTktYWJhZi00N2ViMGQ3ZGNlMzUiLCJpYXQiOjE3NjYwOTU2ODIsImV4cCI6MTc2NjcwMDQ4Mn0.472J136ZHfi51eBlcwOkJTG-DQOWKmYnNRpxuP-72Ns^" ^

  -H ^"Origin: [http://localhost:3000^"](http://localhost:3000^ "http://localhost:3000^") ^

  -H ^"Connection: keep-alive^" ^

  -H ^"Sec-Fetch-Dest: empty^" ^

  -H ^"Sec-Fetch-Mode: cors^" ^

  -H ^"Sec-Fetch-Site: same-site^" ^

  -H ^"Priority: u=0^" ^

  --data-raw ^"^[^{^^"questionId^^":^^"f9b39294-92f4-4bc1-a400-88a44ba033b1^^",^^"value^^":^^"Thalassinus suffragium admitto aequus culpa claustrum candidus.^^"^},^{^^"questionId^^":^^"4f6058bb-9571-4674-bec5-c70a2c093a67^^",^^"value^^":^^"Everything is tidy^^"^},^{^^"questionId^^":^^"b3a2cde7-acf1-4369-915a-22002834d19f^^",^^"value^^":^^"Not sure - no cleaning products^^"^},^{^^"questionId^^":^^"b9cf97a5-37b0-46fa-884b-7e73d053895d^^",^^"value^^":^^"Salmonella^’s best friend^^"^},^{^^"questionId^^":^^"55e4938d-1326-4d9f-a3c3-bd3f6e47c5ad^^",^^"value^^":^^"Washed, dry overnight^^"^},^{^^"questionId^^":^^"10bd0d29-3320-4865-a363-7b235741b166^^",^^"value^^":^^"Decide when need for cleaning arises^^"^},^{^^"questionId^^":^^"c0e58964-5d3e-48b7-8198-b6d73b3a6de5^^",^^"value^^":^^"Usually dinners^^"^},^{^^"questionId^^":^^"b8726738-c4a1-48d8-9b24-e53c2b5a7f48^^",^^"value^^":^^"I^’m Kosher^^"^},^{^^"questionId^^":^^"77eb90c9-9aa6-46fc-81de-fc4ced2a6645^^",^^"value^^":^^"No^^"^},^{^^"questionId^^":^^"398da7cf-1a66-4883-bbc7-8bc9cd723f06^^",^^"value^^":^^"I don^’t drink, but I don^’t mind if you do^^"^},^{^^"questionId^^":^^"fdc3ebb3-48ac-44df-aa75-436960ef3ad4^^",^^"value^^":^^"During daylight hours^^"^},^{^^"questionId^^":^^"84f5c70e-1ca4-4098-a916-2165e4bfd672^^",^^"value^^":^^"Yes, but never in the house^^"^},^{^^"questionId^^":^^"f4e0f388-0f08-4305-9920-558e0fd6a151^^",^^"value^^":^^"I don't mind if you smoke only outside of the house^^"^},^{^^"questionId^^":^^"23aca440-e599-4b11-b656-63b0d59cb7f5^^",^^"value^^":^^"Fur-less critter^^"^},^{^^"questionId^^":^^"e5f21c19-f807-4ed9-832a-b3b67d9eba11^^",^^"value^^":^^"All pets are fine^^"^},^{^^"questionId^^":^^"1c4442fe-36b1-4a3a-b67d-5ad915c76647^^",^^"value^^":^^"I need the silence of a library^^"^},^{^^"questionId^^":^^"cc96eba3-7d04-4b24-a50b-bbf8eaadf7f3^^",^^"value^^":^^"Quiet, background level^^"^},^{^^"questionId^^":^^"0b89ffff-18ef-4e10-bb35-208df6df31d4^^",^^"value^^":^^"Some distractions are ok^^"^},^{^^"questionId^^":^^"c2085f70-2ffd-4716-877f-11d8b744d8c5^^",^^"value^^":^^"Split costs evenly^^"^}^]^"