Taskboard
=========
your on-line tool for task management fun

http://taskboard.cognifide.com

Copyright (c) 2008-2009 Cognifide
http://www.cognifide.com

---

Heavily modified by Jens-Uwe Gaspar (during 2010-2012) with changes to support Scrum:

* Taskboards:
  * added '+'-icon on task-card to add-card or copy card (CTRL-'+')
  * added way to copy cards from row, and move row to new position
  * copy task-card from other taskboard
  * added row-folding to collapse and extend row
  * show notes-icon on task-card with notes
  * replaced card-burndown with plannable taskboard(=Sprint)-burndown
    * setup of sprint with dates (up to 4 week-sprints), velocity, slack, PO-/team-commitments
    * added fix-dialog for sprint-burndown
    * overworked sprint-burndown chart showing burned hours and showing all sprint parameters
  * change burned-hours by moving cards from and into burndown-marked columns
  * added more standard colors for task-cards, for example schema:
    yellow (story), orange (bug), brown (technical debt story/bug), blue (impediment),
    red (blocker), green (task), grey (reserve), magenta (evaluation task/bug)
  * show hours-sum of task-cards per row and column
  * added markup in task-cards with auto-links: <jira:id>, <bug:id>, <http:...>
  * added support for CCPM (Critical Chain Project Management), see 'ChangeLog'
    * add CCPM-info (ID+note) on big-card with "C+"-icon
    * show CCPM-info on small-card and "Tags"-menu

* Projects:
  * added action to clone existing taskboard with hours and initburndown-essentials
  * collapse all taskboards per default

* Bug fixes & Code improvements:
  * bugfix: open big-card & sprint-burndown without jumping to top of page
  * bugfix: fixed big-card-notes help-tooltip
  * bugfix: set updated-date on changes of card/project/taskboard-entities
  * updated jQuery-libs: jquery.js (1.4.2), overlay (1.2.5)
  * extended & fixed jQuery-libs: jeditable, overlay
  * better logging

