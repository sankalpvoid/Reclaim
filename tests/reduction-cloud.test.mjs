import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDayConfirmation,
  confirmationMutationToRow,
  markReductionPlanDirty,
  mergeCloudConfirmations,
  mergeCloudReductionPlan,
  planFromRow,
  planToRow,
  reviewToRow,
  setDayConfirmation
} from '../reduction-cloud.js';

const userId='11111111-1111-4111-8111-111111111111';

const review={reviewedOn:'2026-09-02',from:'2026-08-26',target:18,nextTarget:16,status:'stable',loggedDays:7,average:15,choice:'continue'};
const plan={
  version:1,baseline:20,baselineSource:'confirmed logs',currentTarget:16,stage:2,status:'active',
  startedOn:'2026-08-26',reviewStart:'2026-09-02',lastReviewStatus:'stable',
  lastReview:{status:'stable',nextTarget:16},targetHistory:[{from:'2026-08-26',target:18},{from:'2026-09-02',target:16}],
  minimumAutomaticTarget:1,reductionRate:0.1,reviewWindowDays:7,targetChanged:true,history:[review]
};

test('reduction plan and review mappings preserve engine history',()=>{
  const row=planToRow(plan,userId),reviewRow=reviewToRow(plan.history[0],userId);
  assert.equal(row.current_target,16);
  assert.equal(row.baseline_source,'confirmed logs');
  assert.deepEqual(row.target_history,plan.targetHistory);
  assert.equal(reviewRow.review_start,'2026-08-26');

  const restored=planFromRow(row,[reviewRow]);
  assert.equal(restored.currentTarget,16);
  assert.equal(restored.stage,2);
  assert.equal(restored.history.length,1);
  assert.deepEqual(restored.history[0],plan.history[0]);
});

test('pending review history remains authoritative after plan snapshot reaches cloud',()=>{
  const state={reductionPlan:structuredClone(plan),reductionSync:{}};
  markReductionPlanDirty(state,{reviews:true});
  assert.equal(state.reductionSync.planDirty,true);
  assert.equal(state.reductionSync.reviewsDirty,true);
  assert.deepEqual(state.reductionSync.pendingReviews,[review]);

  // Simulate the plan upsert succeeding while review-history upsert fails.
  state.reductionSync.planDirty=false;
  const restored=mergeCloudReductionPlan(state,planToRow(plan,userId),[]);
  assert.equal(restored.currentTarget,16);
  assert.deepEqual(restored.history,[review]);
  assert.equal(state.reductionSync.reviewsDirty,true);
  assert.deepEqual(state.reductionSync.pendingReviews,[review]);
});

test('plan and confirmation changes create durable pending sync markers',()=>{
  const state={dayConfirmations:{},reductionSync:{}};
  markReductionPlanDirty(state,{reviews:true});
  assert.equal(state.reductionSync.planDirty,true);
  assert.equal(state.reductionSync.reviewsDirty,true);

  assert.equal(setDayConfirmation(state,'2026-09-08','complete',12),true);
  assert.equal(state.dayConfirmations['2026-09-08'],'complete');
  assert.deepEqual(state.reductionSync.confirmations['2026-09-08'],{kind:'upsert',status:'complete',recordedCount:12});
  assert.equal(confirmationMutationToRow('2026-09-08',state.reductionSync.confirmations['2026-09-08'],userId).recorded_count,12);

  assert.equal(clearDayConfirmation(state,'2026-09-08'),true);
  assert.equal(state.dayConfirmations['2026-09-08'],undefined);
  assert.deepEqual(state.reductionSync.confirmations['2026-09-08'],{kind:'delete'});

  const fresh={dayConfirmations:{},reductionSync:{}};
  assert.equal(clearDayConfirmation(fresh,'2026-09-08'),false);
  assert.deepEqual(fresh.reductionSync.confirmations,{});
});

test('cloud confirmations restore while pending local writes stay authoritative',()=>{
  const state={
    dayConfirmations:{'2026-09-05':'complete','2026-09-06':'smoke_free'},
    smokingEvents:[{at:'2026-09-05T12:00:00',cigarettes:9}],
    reductionSync:{confirmations:{
      '2026-09-07':{kind:'upsert',status:'complete',recordedCount:8},
      '2026-09-08':{kind:'delete'}
    }}
  };
  const merged=mergeCloudConfirmations(state,[
    {day:'2026-09-05',status:'untracked'},
    {day:'2026-09-08',status:'complete'},
    {day:'2026-09-09',status:'smoke_free'}
  ]);

  assert.equal(merged['2026-09-05'],'untracked','existing cloud row is canonical during legacy migration');
  assert.equal(merged['2026-09-06'],'smoke_free','legacy local-only confirmation is preserved and queued');
  assert.equal(merged['2026-09-07'],'complete','pending local upsert overlays cloud');
  assert.equal(merged['2026-09-08'],undefined,'pending local delete overlays cloud');
  assert.equal(merged['2026-09-09'],'smoke_free');
  assert.equal(state.reductionSync.confirmations['2026-09-06'].kind,'upsert');
  assert.equal(state.reductionSync.confirmations['2026-09-06'].recordedCount,0);
});
