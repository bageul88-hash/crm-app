package com.pentwo.crmapp;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.telephony.TelephonyManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * CallPlugin — 통화 종료 시 전화번호를 React 앱으로 전달하는 네이티브 플러그인
 *
 * 동작 흐름:
 * 1. 앱 시작 시 startListening() 호출
 * 2. 전화가 오거나 걸릴 때 BroadcastReceiver가 감지
 * 3. 통화 종료(IDLE) 상태가 되면 JS 이벤트 "callEnded" 발생
 * 4. React 앱이 이벤트를 받아 폼에 번호 자동 입력
 */
@CapacitorPlugin(
    name = "CallPlugin",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_PHONE_STATE }, alias = "phoneState"),
        @Permission(strings = { Manifest.permission.READ_CALL_LOG },    alias = "callLog"),
        @Permission(strings = { Manifest.permission.PROCESS_OUTGOING_CALLS }, alias = "outgoing"),
    }
)
public class CallPlugin extends Plugin {

    private CallReceiver callReceiver;
    private boolean isListening = false;

    /** JS에서 호출: 통화 감지 시작 */
    @PluginMethod
    public void startListening(PluginCall call) {
        if (isListening) { call.resolve(); return; }

        callReceiver = new CallReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction(TelephonyManager.ACTION_PHONE_STATE_CHANGED);
        filter.addAction(Intent.ACTION_NEW_OUTGOING_CALL);
        getActivity().registerReceiver(callReceiver, filter);
        isListening = true;
        call.resolve();
    }

    /** JS에서 호출: 통화 감지 중지 */
    @PluginMethod
    public void stopListening(PluginCall call) {
        if (isListening && callReceiver != null) {
            getActivity().unregisterReceiver(callReceiver);
            isListening = false;
        }
        call.resolve();
    }

    /** 통화 종료 이벤트를 JS로 전달 */
    void notifyCallEnded(String phoneNumber, long durationSeconds) {
        JSObject data = new JSObject();
        data.put("phone", phoneNumber != null ? phoneNumber : "");
        data.put("duration", durationSeconds);
        data.put("endedAt", System.currentTimeMillis());
        notifyListeners("callEnded", data);
    }

    // ──────────────────────────────────────────
    // BroadcastReceiver: 전화 상태 변화 감지
    // ──────────────────────────────────────────
    private class CallReceiver extends BroadcastReceiver {
        private String lastNumber = "";
        private long callStartTime = 0;
        private boolean wasRinging = false;

        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();

            // 발신 전화번호 캐치
            if (Intent.ACTION_NEW_OUTGOING_CALL.equals(action)) {
                lastNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER);
                return;
            }

            String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
            if (state == null) return;

            switch (state) {
                case TelephonyManager.EXTRA_STATE_RINGING:
                    // 수신 전화 — 번호 저장
                    String incoming = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
                    if (incoming != null && !incoming.isEmpty()) lastNumber = incoming;
                    wasRinging = true;
                    break;

                case TelephonyManager.EXTRA_STATE_OFFHOOK:
                    // 통화 시작 — 시작 시각 기록
                    callStartTime = System.currentTimeMillis();
                    break;

                case TelephonyManager.EXTRA_STATE_IDLE:
                    // 통화 종료
                    long duration = callStartTime > 0
                        ? (System.currentTimeMillis() - callStartTime) / 1000
                        : 0;

                    // 실제 통화가 연결됐을 때만 이벤트 발생 (duration > 3초)
                    if (duration > 3 && !lastNumber.isEmpty()) {
                        notifyCallEnded(lastNumber, duration);
                    }

                    // 초기화
                    callStartTime = 0;
                    wasRinging = false;
                    break;
            }
        }
    }
}
