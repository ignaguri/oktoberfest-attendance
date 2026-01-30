-- Migration: Localize achievements
-- Replace hardcoded English text with i18n translation keys
-- Using original name as lookup (safer than UUIDs)

-- Consumption achievements
UPDATE achievements SET
  name = 'achievements.items.firstDrop.name',
  description = 'achievements.items.firstDrop.description'
WHERE name = 'First Drop';

UPDATE achievements SET
  name = 'achievements.items.beerRookie.name',
  description = 'achievements.items.beerRookie.description'
WHERE name = 'Beer Rookie';

UPDATE achievements SET
  name = 'achievements.items.halfwayThere.name',
  description = 'achievements.items.halfwayThere.description'
WHERE name = 'Halfway There';

UPDATE achievements SET
  name = 'achievements.items.seriousSession.name',
  description = 'achievements.items.seriousSession.description'
WHERE name = 'Serious Session';

UPDATE achievements SET
  name = 'achievements.items.seriousDrinker.name',
  description = 'achievements.items.seriousDrinker.description'
WHERE name = 'Serious Drinker';

UPDATE achievements SET
  name = 'achievements.items.doubleDigits.name',
  description = 'achievements.items.doubleDigits.description'
WHERE name = 'Double Digits';

UPDATE achievements SET
  name = 'achievements.items.dailyDouble.name',
  description = 'achievements.items.dailyDouble.description'
WHERE name = 'Daily Double';

UPDATE achievements SET
  name = 'achievements.items.beerEnthusiast.name',
  description = 'achievements.items.beerEnthusiast.description'
WHERE name = 'Beer Enthusiast';

UPDATE achievements SET
  name = 'achievements.items.powerHour.name',
  description = 'achievements.items.powerHour.description'
WHERE name = 'Power Hour';

UPDATE achievements SET
  name = 'achievements.items.marathonDrinker.name',
  description = 'achievements.items.marathonDrinker.description'
WHERE name = 'Marathon Drinker';

UPDATE achievements SET
  name = 'achievements.items.centuryClub.name',
  description = 'achievements.items.centuryClub.description'
WHERE name = 'Century Club';

UPDATE achievements SET
  name = 'achievements.items.legendStatus.name',
  description = 'achievements.items.legendStatus.description'
WHERE name = 'Legend Status';

-- Attendance achievements
UPDATE achievements SET
  name = 'achievements.items.festivalNewcomer.name',
  description = 'achievements.items.festivalNewcomer.description'
WHERE name = 'Festival Newcomer';

UPDATE achievements SET
  name = 'achievements.items.regular.name',
  description = 'achievements.items.regular.description'
WHERE name = 'Regular';

UPDATE achievements SET
  name = 'achievements.items.earlyBird.name',
  description = 'achievements.items.earlyBird.description'
WHERE name = 'Early Bird';

UPDATE achievements SET
  name = 'achievements.items.dedicated.name',
  description = 'achievements.items.dedicated.description'
WHERE name = 'Dedicated';

UPDATE achievements SET
  name = 'achievements.items.streakMaster.name',
  description = 'achievements.items.streakMaster.description'
WHERE name = 'Streak Master';

UPDATE achievements SET
  name = 'achievements.items.weekendWarrior.name',
  description = 'achievements.items.weekendWarrior.description'
WHERE name = 'Weekend Warrior';

UPDATE achievements SET
  name = 'achievements.items.festivalWarrior.name',
  description = 'achievements.items.festivalWarrior.description'
WHERE name = 'Festival Warrior';

-- Explorer achievements
UPDATE achievements SET
  name = 'achievements.items.tentCurious.name',
  description = 'achievements.items.tentCurious.description'
WHERE name = 'Tent Curious';

UPDATE achievements SET
  name = 'achievements.items.tentHopper.name',
  description = 'achievements.items.tentHopper.description'
WHERE name = 'Tent Hopper';

UPDATE achievements SET
  name = 'achievements.items.wiesnWanderer.name',
  description = 'achievements.items.wiesnWanderer.description'
WHERE name = 'Wiesn Wanderer';

UPDATE achievements SET
  name = 'achievements.items.localGuide.name',
  description = 'achievements.items.localGuide.description'
WHERE name = 'Local Guide';

UPDATE achievements SET
  name = 'achievements.items.tentMaster.name',
  description = 'achievements.items.tentMaster.description'
WHERE name = 'Tent Master';

-- Social achievements
UPDATE achievements SET
  name = 'achievements.items.teamPlayer.name',
  description = 'achievements.items.teamPlayer.description'
WHERE name = 'Team Player';

UPDATE achievements SET
  name = 'achievements.items.groupLeader.name',
  description = 'achievements.items.groupLeader.description'
WHERE name = 'Group Leader';

UPDATE achievements SET
  name = 'achievements.items.photoEnthusiast.name',
  description = 'achievements.items.photoEnthusiast.description'
WHERE name = 'Photo Enthusiast';

UPDATE achievements SET
  name = 'achievements.items.socialButterfly.name',
  description = 'achievements.items.socialButterfly.description'
WHERE name = 'Social Butterfly';

UPDATE achievements SET
  name = 'achievements.items.topContributor.name',
  description = 'achievements.items.topContributor.description'
WHERE name = 'Top Contributor';

UPDATE achievements SET
  name = 'achievements.items.groupChampion.name',
  description = 'achievements.items.groupChampion.description'
WHERE name = 'Group Champion';

UPDATE achievements SET
  name = 'achievements.items.memoryKeeper.name',
  description = 'achievements.items.memoryKeeper.description'
WHERE name = 'Memory Keeper';

-- Competitive achievements
UPDATE achievements SET
  name = 'achievements.items.risingStar.name',
  description = 'achievements.items.risingStar.description'
WHERE name = 'Rising Star';

UPDATE achievements SET
  name = 'achievements.items.multiGroupChampion.name',
  description = 'achievements.items.multiGroupChampion.description'
WHERE name = 'Multi-Group Champion';

UPDATE achievements SET
  name = 'achievements.items.leaderboardLegend.name',
  description = 'achievements.items.leaderboardLegend.description'
WHERE name = 'Leaderboard Legend';

-- Special achievements
UPDATE achievements SET
  name = 'achievements.items.closingTime.name',
  description = 'achievements.items.closingTime.description'
WHERE name = 'Closing Time';

UPDATE achievements SET
  name = 'achievements.items.openingDayLegend.name',
  description = 'achievements.items.openingDayLegend.description'
WHERE name = 'Opening Day Legend';

UPDATE achievements SET
  name = 'achievements.items.consistencyKing.name',
  description = 'achievements.items.consistencyKing.description'
WHERE name = 'Consistency King';

UPDATE achievements SET
  name = 'achievements.items.festivalVeteran.name',
  description = 'achievements.items.festivalVeteran.description'
WHERE name = 'Festival Veteran';

UPDATE achievements SET
  name = 'achievements.items.photoPerfect.name',
  description = 'achievements.items.photoPerfect.description'
WHERE name = 'Photo Perfect';

UPDATE achievements SET
  name = 'achievements.items.highRoller.name',
  description = 'achievements.items.highRoller.description'
WHERE name = 'High Roller';

UPDATE achievements SET
  name = 'achievements.items.multiYearChampion.name',
  description = 'achievements.items.multiYearChampion.description'
WHERE name = 'Multi-Year Champion';
