import {isObservable} from 'rxjs';
import {last} from 'rxjs/operators';

import ActivitiesSDKAdapter from './ActivitiesSDKAdapter';
import createMockSDK, {mockSDKCardActivity} from './mockSdk';

describe('Activities SDK Adapter', () => {
  let mockSDK;
  let activitiesSDKAdapter;
  let activityID;
  const activityWithoutCard = {
    ID: 'activityID1',
    roomID: 'roomID1',
    text: 'text1',
    personID: 'personID1',
    created: '2021-02-02T14:38:16+00:00',
  };

  beforeEach(() => {
    mockSDK = createMockSDK();
    activitiesSDKAdapter = new ActivitiesSDKAdapter(mockSDK);
    activityID = 'activityID';
  });

  afterEach(() => {
    mockSDK = null;
    activitiesSDKAdapter = null;
    activityID = null;
  });

  describe('getActivity()', () => {
    beforeEach(() => {
      activitiesSDKAdapter.fetchActivity = jest.fn(
        () => Promise.resolve(mockSDKCardActivity),
      );
    });

    test('returns an observable', () => {
      expect(isObservable(activitiesSDKAdapter.getActivity(activityID))).toBeTruthy();
    });

    test('emits activity details on subscription', (done) => {
      activitiesSDKAdapter.getActivity(activityID).subscribe(
        (activity) => {
          expect(activity).toMatchObject({
            ID: 'activityID',
            roomID: 'roomID',
            text: 'text',
            personID: 'personID',
            attachments: [
              {
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                  $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                  type: 'AdaptiveCard',
                  version: '1.2',
                  body: [
                    {
                      type: 'TextBlock',
                      text: 'Adaptive Cards',
                      size: 'large',
                    },
                  ],
                  actions: [
                    {
                      type: 'Action.OpenUrl',
                      url: 'http://adaptivecards.io',
                      title: 'Learn More',
                    },
                  ],
                },
              },
            ],
            created: '2022-02-02T14:38:16+00:00',
          });
          done();
        },
      );
    });

    test('throws an error on invalid activity ID', (done) => {
      const sdkError = new Error('Could not find activity with ID "badActivityID"');

      activitiesSDKAdapter.fetchActivity = jest.fn(() => Promise.reject(sdkError));

      activitiesSDKAdapter.getActivity('badActivityID').subscribe(
        () => {},
        (error) => {
          expect(error.message).toBe(sdkError.message);
          done();
        },
      );
    });
  });

  describe('postActivity()', () => {
    test('emits the posted Activity object', (done) => {
      const activityData = {
        roomID: 'roomID',
        text: 'text',
        card: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          body: [
            {
              type: 'TextBlock',
              text: 'Adaptive Cards',
              size: 'large',
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              url: 'http://adaptivecards.io',
              title: 'Learn More',
            },
          ],
        },
      };

      activitiesSDKAdapter.postActivity(activityData).pipe(last()).subscribe((activity) => {
        expect(activity).toMatchObject({
          ID: 'activityID',
          roomID: 'roomID',
          text: 'text',
          personID: 'personID',
          created: '2022-02-02T14:38:16+00:00',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.2',
                body: [
                  {
                    type: 'TextBlock',
                    text: 'Adaptive Cards',
                    size: 'large',
                  },
                ],
                actions: [
                  {
                    type: 'Action.OpenUrl',
                    url: 'http://adaptivecards.io',
                    title: 'Learn More',
                  },
                ],
              },
            },
          ],
        });
        done();
      });
    });

    test('emits the sdk error when messages.create returns a rejected promise', (done) => {
      const sdkError = new Error('sdk-error');

      activitiesSDKAdapter.datasource.messages.create = jest.fn(() => Promise.reject(sdkError));

      activitiesSDKAdapter.postActivity({}).subscribe(
        () => {
          done.fail('Posted an activity instead of returning error');
        },
        (error) => {
          expect(error).toBe(sdkError);
          done();
        },
      );
    });
  });

  describe('postAction()', () => {
    test('emits the posted action object', (done) => {
      const inputs = {
        firstName: 'My first name',
        lastname: 'My last name',
      };

      activitiesSDKAdapter.postAction(activityID, inputs).pipe(last()).subscribe((action) => {
        expect(action).toMatchObject({
          actionID: 'actionID',
          activityID: 'activityID',
          inputs: {
            firstName: 'My first name',
            lastName: 'My last name',
          },
          roomID: 'roomID',
          personID: 'personID',
          type: 'submit',
          created: '2022-02-03T14:26:16+00:00',
        });
        done();
      });
    });

    test('emits the sdk error when attachmentActions.create returns a rejected promise', (done) => {
      const sdkError = new Error('sdk-error');

      activitiesSDKAdapter.datasource.attachmentActions.create = jest.fn(
        () => Promise.reject(sdkError),
      );

      activitiesSDKAdapter.postAction({}).subscribe(
        () => {
          done.fail('Created attachment action instead of returning error');
        },
        (error) => {
          expect(error).toBe(sdkError);
          done();
        },
      );
    });
  });

  describe('hasAdaptiveCard()', () => {
    test('returns true if activity object has a card attachment', () => {
      const hasCard = activitiesSDKAdapter.hasAdaptiveCard(mockSDKCardActivity);

      expect(hasCard).toBeTruthy();
    });

    test('returns false if activity object does not have a card attachment', () => {
      const hasCard = activitiesSDKAdapter.hasAdaptiveCard(activityWithoutCard);

      expect(hasCard).toBeFalsy();
    });
  });

  describe('getAdaptiveCard()', () => {
    test('returns the card object if the activity object has a card attachment', () => {
      const cardAttachment = activitiesSDKAdapter.getAdaptiveCard(mockSDKCardActivity);

      expect(cardAttachment).toMatchObject({
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
          {
            type: 'TextBlock',
            text: 'Adaptive Cards',
            size: 'large',
          },
        ],
        actions: [
          {
            type: 'Action.OpenUrl',
            url: 'http://adaptivecards.io',
            title: 'Learn More',
          },
        ],
      });
    });

    test('returns undefined if Activity object has a card attachment', () => {
      const cardAttachment = activitiesSDKAdapter.getAdaptiveCard(activityWithoutCard);

      expect(cardAttachment).toBeUndefined();
    });
  });

  describe('attachAdaptiveCard()', () => {
    test('add an adaptive card attachment to the activity', () => {
      const activity = {
        roomID: 'roomID3',
        text: 'text3',
      };
      const cardToAttach = {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
          {
            type: 'TextBlock',
            text: 'Adaptive Cards',
            size: 'large',
          },
        ],
        actions: [
          {
            type: 'Action.OpenUrl',
            url: 'http://adaptivecards.io',
            title: 'Learn More',
          },
        ],
      };

      activitiesSDKAdapter.attachAdaptiveCard(activity, cardToAttach);

      expect(activity).toMatchObject({
        roomID: 'roomID3',
        text: 'text3',
        attachments: [{
          contenType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.2',
            body: [
              {
                type: 'TextBlock',
                text: 'Adaptive Cards',
                size: 'large',
              },
            ],
            actions: [
              {
                type: 'Action.OpenUrl',
                url: 'http://adaptivecards.io',
                title: 'Learn More',
              },
            ],
          },
        }],
      });
    });
  });
});
