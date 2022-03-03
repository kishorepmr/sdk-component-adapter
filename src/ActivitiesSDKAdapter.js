import {ActivitiesAdapter} from '@webex/component-adapter-interfaces';
import {
  from,
  Observable,
  ReplaySubject,
  defer,
} from 'rxjs';
import {
  catchError,
  map,
  tap,
} from 'rxjs/operators';

import logger from './logger';

/**
 * An activity a person performs in Webex.
 *
 * @external Activity
 * @see {@link https://github.com/webex/component-adapter-interfaces/blob/master/src/ActivitiesAdapter.js#L6}
 */

/**
 * Maps SDK activity to adapter activity
 *
 * @private
 * @param {object} sdkActivity  SDK activity object
 * @returns {Activity} Adapter activity object
 */
function fromSDKActivity(sdkActivity) {
  return {
    ID: sdkActivity.id,
    roomID: sdkActivity.roomId,
    text: sdkActivity.text,
    personID: sdkActivity.personId,
    attachments: sdkActivity.attachments || [],
    created: sdkActivity.created,
  };
}

/**
 * The `ActivitiesSDKAdapter` is an implementation of the `ActivitiesAdapter` interface.
 * This implementation utilizes the Webex JS SDK as its source of activity data.
 *
 * @see {@link ActivitiesJSON}
 * @implements {ActivitiesAdapter}
 */
/* eslint-disable no-useless-constructor */
export default class ActivitiesSDKAdapter extends ActivitiesAdapter {
  constructor(datasource) {
    super(datasource);

    this.activityObservables = {};
  }

  /**
   * Loads activity data from Webex and returns a promise that resolves to an Activity object
   *
   * @param {string} activityID  Id of the activity for which to fetch data
   * @returns {Promise.<Activity>} Information about the activity of the given ID
   *
   * @private
   */
  fetchActivity(activityID) {
    logger.debug('ACTIVITY', activityID, 'fetchActivity()', ['called with', {activityID}]);

    return this.datasource.messages.get(activityID);
  }

  /**
   * Returns an observable that emits activity data of the given ID.
   *
   * @param {string} ID  Id of activity to get
   * @returns {external:Observable.<Activity>} Observable stream that emits activity data
   */
  getActivity(ID) {
    logger.debug('ACTIVITY', ID, 'getActivity()', ['called with', {ID}]);

    if (!(ID in this.activityObservables)) {
      // use ReplaySubject cause we don't need to set an initial value
      this.activityObservables[ID] = new ReplaySubject(1);

      defer(() => this.fetchActivity(ID)).pipe(
        map(fromSDKActivity),
      ).subscribe(
        (activity) => {
          logger.debug('ACTIVITY', ID, 'getActivity()', ['emitting activity object', activity]);
          this.activityObservables[ID].next(activity);
        },
        (error) => {
          logger.error('ACTIVITY', ID, 'getActivity()', 'Error fetching activity', error);
          this.activityObservables[ID].error(new Error(`Could not find activity with ID "${ID}"`));
        },
      );
    }

    return this.activityObservables[ID];
  }

  /**
   * Posts an attachment action, returns an observable that emits the created action
   *
   * @param {string} activityID  ID of the activity corresponding to this submit action
   * @param {object} inputs  The message content
   * @returns {Observable.<object>} Observable stream that emits data of the newly created action
   */
  postAction(activityID, inputs) {
    logger.debug('ATTACHMENT-ACTION', undefined, 'postAction()', ['called with', {activityID, inputs}]);

    const action$ = from(this.datasource.attachmentActions.create({
      type: 'submit',
      messageId: activityID,
      inputs,
    })).pipe(
      map((action) => ({
        actionID: action.id,
        activityID: action.messageId,
        inputs: action.inputs,
        roomID: action.roomId,
        personID: action.personId,
        type: action.type,
        created: action.created,
      })),
      tap((action) => {
        logger.debug('ATTACHMENT-ACTION', action.actionID, 'postAction()', ['emitting posted attachment action', action]);
      }),
      catchError((err) => {
        logger.error('ATTACHMENT-ACTION', undefined, 'postAction()', `Unable to create an attachment for activity with id "${activityID}"`, err);
        throw err;
      }),
    );

    return action$;
  }

  /**
   * Posts an activity and returns an observable to the new activity data
   *
   * @param {object} activity  The activity to post
   * @returns {Observable.<Activity>} Observable that emits the posted activity (including id)
   */
  postActivity(activity) {
    const activity$ = from(this.datasource.messages.create({
      roomId: activity.roomID,
      text: activity.text,
      attachments: activity.attachments,
    })).pipe(
      map(fromSDKActivity),
      catchError((err) => {
        logger.error('ACTIVITY', undefined, 'postActivity()', ['Unable to post activity', activity], err);
        throw err;
      }),
    );

    return activity$;
  }

  /**
   * A function that checks whether or not an Activity object contains a card attachment.
   *
   * @param {Activity} activity  Activity object
   * @returns {boolean} True if received Activity object contains a card attachment
   */
  // eslint-disable-next-line class-methods-use-this
  hasAdaptiveCard(activity) {
    return !!(activity.attachments && activity.attachments[0] && activity.attachments[0].contentType === 'application/vnd.microsoft.card.adaptive');
  }

  /**
   * A function that returns adaptive card data of an Activity object.
   *
   * @param {Activity} activity  Activity object
   * @returns {object|undefined} Adaptive card data object
   */
  // eslint-disable-next-line class-methods-use-this
  getAdaptiveCard(activity) {
    const hasCard = this.hasAdaptiveCard(activity);

    return hasCard ? activity.attachments[0].content : undefined;
  }

  /**
   * A function that attaches an adaptive card to an Activity object.
   *
   * @param {Activity} activity  The activity to post
   * @param {object} card  The card attachment
   */
  // eslint-disable-next-line class-methods-use-this
  attachAdaptiveCard(activity, card) {
    const mutableActivity = activity;

    mutableActivity.attachments = [{
      contenType: 'application/vnd.microsoft.card.adaptive',
      content: card,
    }];
  }
}
