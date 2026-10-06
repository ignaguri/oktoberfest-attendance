import type { FriendWent } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase, groupFriendsWent } from "@prostcounter/shared/utils";

import { NotFoundError } from "../middleware/error";
import type { IFriendsWentRepository } from "../repositories/interfaces";

/**
 * Who went on a festival day so far, for the day sheet's Friends and Today tabs.
 */
export class FriendsWentService {
  constructor(
    private repo: IFriendsWentRepository,
    private now: () => Date = () => new Date(),
  ) {}

  /**
   * Friends and group-mates who logged `date`. Later days return nobody,
   * decided on the festival's clock.
   */
  async getFriendsWent(viewerId: string, festivalId: string, date: string): Promise<FriendWent[]> {
    const timezone = await this.repo.getFestivalTimezone(festivalId);

    if (!timezone) {
      throw new NotFoundError(ErrorCodes.FESTIVAL_NOT_FOUND);
    }

    if (date > formatDateForDatabase(this.now(), timezone)) {
      return [];
    }

    const rows = await this.repo.listDayRows(viewerId, festivalId, date);

    return groupFriendsWent({ date, timezone, ...rows });
  }
}
