# GitHub - Version Control for Beginners

## What is GitHub?

**Git** is a tool that tracks every change you make to your code. Think of it like "Track Changes" in Microsoft Word, but for entire folders of code.

**GitHub** is a website that stores your Git history online - so your code is backed up, shareable, and can trigger other services (like Vercel deployments).

```mermaid
flowchart LR
    Local[Your Computer local code]
    GitHub[GitHub cloud backup and history]
    Vercel[Vercel auto-deploys when you push]

    Local -->|"git push"| GitHub
    GitHub -->|"webhook trigger"| Vercel
```

---

## Why Do You Need Version Control?

Without Git, you might:
- Accidentally delete code and have no way to get it back
- Not remember what you changed last week
- Break something and not know what caused it
- Have to email `.zip` files to collaborators

With Git:
- Every saved version is permanent and labelled
- You can go back to any point in time
- You know exactly what changed, when, and why

---

## The Core Concepts

```mermaid
flowchart TD
    WorkingFiles[Working Files what you see in your editor]
    StagingArea[Staging Area what will be in the next commit]
    LocalRepo[Local Repository .git folder on your machine]
    GitHub[GitHub remote repository]

    WorkingFiles -->|"git add"| StagingArea
    StagingArea -->|"git commit"| LocalRepo
    LocalRepo -->|"git push"| GitHub
    GitHub -->|"git pull"| LocalRepo
```

| Command | What it does |
|---------|-------------|
| `git add filename` | Stage a file (prepare it for saving) |
| `git add .` | Stage all changed files |
| `git commit -m "message"` | Save a snapshot with a label |
| `git push` | Upload your commits to GitHub |
| `git pull` | Download new commits from GitHub |
| `git status` | See what has changed |
| `git log` | See the history of commits |

---

## What is a Commit?

A **commit** is a saved snapshot of your code at a specific moment. Think of it like a save point in a video game.

```mermaid
gitGraph
    commit id: "Initial scaffold"
    commit id: "Add login page"
    commit id: "Add dashboard layout"
    commit id: "Fix occupancy calculation"
    commit id: "Add booking modal"
```

Each commit has:
- A unique ID (e.g. `6f62a37`)
- A message (what you changed)
- A timestamp (when)
- The author (who)

**Good commit messages** describe WHY you made the change, not just what:
```
Bad:  "fix stuff"
Bad:  "changed modal"
Good: "Fix checkout date not saving correctly"
Good: "Add room filter dropdown to bookings page"
```

---

## Everyday Git Workflow

Here is what your daily workflow looks like:

```mermaid
flowchart TD
    Start[Start working] --> Pull[git pull get latest code]
    Pull --> Code[Write code in VS Code]
    Code --> Check[git status see what changed]
    Check --> Stage[git add . stage all changes]
    Stage --> Commit[git commit save a snapshot]
    Commit --> Push[git push upload to GitHub]
    Push --> Vercel[Vercel auto-deploys live in ~1 minute]
    Vercel --> More{More to do?}
    More -->|Yes| Code
    More -->|No| Done[Done for the day]
```

---

## What is a Branch?

A **branch** is a separate line of development. You use branches to work on a new feature without breaking the working code.

```mermaid
gitGraph
    commit id: "Stable working app"
    commit id: "Add cleaning page"

    branch feature/monthly-summary
    checkout feature/monthly-summary
    commit id: "Start monthly page"
    commit id: "Add income columns"
    commit id: "Add totals row"

    checkout main
    merge feature/monthly-summary id: "Merge monthly summary"
    commit id: "Deploy to production"
```

For a solo project like yours, working directly on `main` is perfectly fine. Branches become more important when multiple people work on the same codebase.

---

## What is a .gitignore File?

A `.gitignore` file tells Git which files to **never track**. Your project already has one.

Things that should NEVER go to GitHub:
- `.env.local` - contains secret keys (your Supabase passwords)
- `node_modules/` - thousands of files auto-installed by npm
- `.next/` - the compiled build output (can always be rebuilt)

```
# .gitignore
.env.local
.env*.local
node_modules/
.next/
```

If you accidentally commit a secret key, you must rotate (regenerate) it immediately - deleting it from the repo is not enough, because GitHub keeps the full history.

---

## The GitHub Repository

Your repository at GitHub holds:

```mermaid
flowchart TD
    Repo[GitHub Repository]
    Repo --> Code[All your source code]
    Repo --> History[Full commit history]
    Repo --> Issues[Issues bugs and tasks]
    Repo --> Actions[Actions automated workflows]
    Repo --> Settings[Settings Vercel webhook etc]
```

**Repository URL pattern:** `github.com/your-username/your-repo-name`

---

## Reading the Git Log

```bash
git log --oneline
```

Output:
```
cae45f9 Add .gitignore covering .env, node_modules, Next.js build output
6f62a37 Replace in-app AI parsing with /new-booking Claude Code slash command
1af49f6 Fix Mermaid diagram syntax for broad renderer compatibility
e837272 Expand planning doc with Mermaid diagrams, user journeys, and setup guide
```

Each line = one commit. The short code on the left (`cae45f9`) is the commit ID. You can inspect any commit with `git show cae45f9`.

---

## Undoing Mistakes

| Situation | Command | What it does |
|-----------|---------|-------------|
| I staged the wrong file | `git restore --staged filename` | Unstage it |
| I want to undo my last commit (keep the changes) | `git reset HEAD~1` | Uncommit but keep edits |
| I want to see what changed | `git diff` | Show all unstaged changes |

**Important:** Never use `git reset --hard` unless you are sure - it deletes your work permanently.

---

## Summary - Git Commands Cheat Sheet

```bash
# Check what's changed
git status

# Stage all changes
git add .

# Save a commit
git commit -m "What and why you changed"

# Upload to GitHub
git push

# Download latest from GitHub
git pull

# See history
git log --oneline

# See what changed in a file
git diff filename
```

GitHub is your safety net. Commit often (several times a day), write clear messages, and push regularly so your work is never just on one machine.
