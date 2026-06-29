# 20-Something — go-viral roadmap

The goal is not "do marketing." It is to make the product share itself, then
pour fuel on the loop that already works. 20-Something ships the same viral
machine Wordle used: a single daily puzzle everyone plays, a spoiler-free result
card built to post, friend-challenge links that open in a browser, and a streak
that hurts to lose. The job is to sharpen that loop, remove every gap that leaks
a would-be sharer, and aim a content engine at it.

This is the standing plan. Phases are ordered by leverage, not by calendar.

---

## 0. The one number that matters

**k-factor** = (invites sent per player) × (conversion per invite). Above 1.0 and
growth compounds on its own. Everything below either raises invites sent (more
shares, better share artifact, lower friction) or raises conversion (the link
lands somewhere that converts: a fast web round, not an App Store dead end).

Track weekly: k-factor, D1 / D7 retention, daily-challenge completion rate,
share rate (% of finished sessions that hit share), and challenge-link click →
play conversion. If a tactic does not move one of these, drop it.

---

## 1. Close the loop leaks first (do this before any spend)

The product is ~90% of the way to a self-propelling loop. These gaps each silently
kill shares or conversions and are worth more than any ad.

1. **Image share card, not just text.** The `ShareCard` is built to be captured
   (the code already notes `react-native-view-shot`). A branded PNG with stars,
   ⚡ time, 🎯 accuracy, 🔥 streak, and "beat X% of today" is dramatically more
   tappable in a group chat or on a feed than a line of text. This is the single
   highest-leverage build item. Ship it.
2. **Deep links that actually open the round.** A challenge link must land a
   first-timer directly in the exact shared deal (web-first is already the right
   call) with a one-tap "play this round" and a soft "get the app for your
   streak" after they finish. No app-install wall before the fun.
3. **Web landing page that ranks and converts.** A real page at the root domain:
   plays a sample round inline, shows today's card teaser, "how it works" in two
   sentences, and an App Store / Play badge. SEO target the long tail people
   actually search: "24 card game online", "math card game", "make 24 solver",
   "daily math puzzle". The companion calculator/solver is a search magnet, lean
   on it as a top-of-funnel free tool that cross-links into the game.
4. **One-tap "Challenge a friend" everywhere a result appears.** Summary screen,
   share card, end of a live room. The result is the ad; the challenge button is
   the call to action.
5. **Streak + push, tuned for return, not nagging.** The freeze mechanic is
   already loss-aversion done right. The daily reminder push should fire at the
   user's usual play time and lead with what they will lose ("🔥 7-day streak,
   today's card is live"), not a generic ping.

Definition of done for Phase 1: a brand-new person can tap a friend's link, play
the exact same deal in their browser in under five seconds, see their result as a
postable image, and challenge someone back, all without an install.

---

## 2. Pick the wedge audience (win a niche before the masses)

Viral things start narrow. Three concentric rings, attack inside-out:

- **Ring 1, the 24-game faithful.** The "make 24" card game has a devoted base
  (math-team kids, competitive-math parents, ex-Math-League adults). They already
  search for it. They will adopt a clean daily version instantly and evangelize.
- **Ring 2, the daily-puzzle habit crowd.** People who already do Wordle,
  Connections, the Mini. Same ritual, new flavor, posts the same way.
- **Ring 3, math teachers and #MathTok.** A daily, shareable, no-account mental-math
  game is a free classroom warm-up. Teachers are force multipliers: one teacher
  equals a class equals 30 nightly players plus parents.

Lead with Ring 1 and Ring 3 because they have existing watering holes and a reason
to share beyond vanity.

---

## 3. The content engine (the actual fuel)

Short-form video is the cheapest path to reach for a puzzle. The format that works
for this genre is "can YOU solve it before the timer." Build a repeatable factory,
not one-off posts.

**Formats (rotate, post daily):**
- "Solve this in 5 seconds" — show four cards + target, countdown, reveal. The
  comment section solves it for you (engagement = reach). End on the app's daily.
- "Today's 20-Something" — a daily clip of the real daily card. Makes the account
  a habit, mirrors the in-app ritual.
- "Watch me speedrun a 5/5" — screen capture of a fast run with the win flourish
  and the share card reveal. Shows the dopamine and the artifact in one shot.
- "Hardest hand of the week" — an unsolvable or near-impossible deal, "is there a
  solution? (there isn't, and that's the trap)". The judge mechanic is unique,
  most 24 clones do not have "declare no solution." Lean on it, it is a hook.
- Duet / stitch bait: post a hand and explicitly ask for stitches with people's
  solutions.

**Channels, in priority order:** TikTok and Instagram Reels first (puzzle content
overperforms there), YouTube Shorts as a mirror, then a subreddit presence
(r/puzzles, r/math, r/24, r/mathteachers) where you post the daily as a
non-spammy "today's card" thread and let the comments solve it.

**Cadence:** one daily clip tied to the real daily, plus two or three "solve this"
hooks per week. Batch-film weekly. Consistency beats production value here.

---

## 4. Launch moments (concentrated spikes on top of the steady engine)

- **Waitlist + "founding streak."** Pre-launch landing page collects emails with a
  hook: first N players get a permanent badge / their streak counted from day one.
  Scarcity + streak loss-aversion before the product even opens.
- **Product Hunt launch.** A daily-puzzle game with a slick share card is a natural
  PH hit. Line up the Ring 1 / Ring 3 audience to upvote and comment at launch.
  Target a top-5 day.
- **Seed the communities the same week.** Hacker News ("Show HN: a daily make-24
  card game, no account, plays in the browser"), the relevant subreddits, math
  Discords/Slacks. The web-first, no-login round is the thing that makes these
  land: people can try it in the thread.
- **Teacher / creator seeding.** Send 25–50 math teachers and mid-size #MathTok
  creators a personal note plus a ready-to-post daily card. No money needed at
  first, the product is the pitch. A handful adopting it as a class warm-up is a
  durable channel.

---

## 5. Retention is half of virality

A viral spike with no retention is a bucket with a hole. The loop only compounds
if yesterday's new players are still here tomorrow to invite tomorrow's.

- Daily challenge + streak + freeze is the spine, already built. Protect it.
- Weekly recap push ("you beat X% this week, here's your card") to re-trigger the
  share on a different cadence than the daily.
- Rivals / head-to-head record turns a one-off challenge into a series. Surface it:
  "you're 3-2 vs Alex, rematch?" That is a recurring, personal reason to come back
  and to invite.
- Live rooms are the group-event surface: party mode, classroom mode, "play with
  friends right now." Good for the content engine (multiplayer clips) and for
  occasion-based spikes.

---

## 6. 90-day shape (leverage order, not rigid dates)

- **Weeks 1–3:** Phase 1 loop fixes (image share card, deep links, web landing).
  Stand up the TikTok/Reels account and start posting "solve this" hooks daily to
  build a back catalog before launch.
- **Weeks 4–6:** Waitlist live, founding-streak hook. Keep posting daily. Seed a
  handful of teachers and creators quietly, gather testimonials and clips.
- **Weeks 7–8:** Coordinated launch week: Product Hunt + Show HN + subreddits +
  creator posts all inside a few days, riding the back catalog and waitlist.
- **Weeks 9–12:** Read the metrics. Double down on whichever ring and channel
  produced the best k-factor and D7. Start the rivals/rematch and weekly-recap
  loops to lift retention. Only consider paid acquisition once organic k-factor is
  near or above 1.0, paid on a leaky loop just burns money faster.

---

## 7. What I would NOT do

- No paid ads until the organic loop retains and k-factor approaches 1.0.
- No account wall or install wall before the first round. Friction here is fatal.
- No spammy community posting. One genuine "today's card" presence per community,
  not link drops.
- No spoilers in any share artifact. The card shows the result, never the cards,
  target, or solution. That rule is what makes posting it safe and contagious.

---

## TL;DR

The product is the marketing. Make the result a beautiful image, make the link
open the round instantly in a browser, point a daily short-form video habit at the
24-game faithful and math teachers, launch in one concentrated week on Product
Hunt + HN + Reddit, and protect the streak so the people you acquire stay to
invite the next wave. Watch k-factor; if it crosses 1.0, growth runs itself.
