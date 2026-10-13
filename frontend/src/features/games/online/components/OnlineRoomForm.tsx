/**
 * OnlineRoomForm.tsx — 방 만들기(대기실)와 방 정보 수정(방 안, 방장)에 함께 쓰는 폼
 *
 * React Hook Form + zod: 입력 규칙을 스키마 한 곳에 적고, 틀리면 칸 아래에 이유를 보여 준다.
 * 서버(OnlineRoom)도 같은 규칙으로 다시 검사한다. 화면 검사는 "빨리 알려 주기", 서버 검사는 "진짜 지키기"다.
 *
 * [비밀번호 칸이 모드마다 다른 이유]
 *   서버는 비밀번호 원문을 모른다(해시만 있다). 그래서 수정할 때 지금 비밀번호를 칸에 채워 줄 수 없다.
 *   대신 "그대로 / 바꾸기 / 해제" 중 하나를 고르게 한다.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { OnlineRoomFormValues } from "@/features/games/online/onlineRoomHelpers";
import type { OnlineGameTypeInfo } from "@/features/games/online/onlineTypes";


const createRoomFormSchema = (gameTypes: OnlineGameTypeInfo[], requireNewPassword: boolean) => z.object({
  title: z.string().trim().min(1, "방 제목을 입력해 주세요.").max(30, "방 제목은 30자 이하로 입력해 주세요."),
  gameType: z.string().min(1, "게임을 골라 주세요."),
  seatCount: z.number().int(),
  password: z.string().max(20, "비밀번호는 4~20자로 입력해 주세요."),
  passwordMode: z.enum(["KEEP", "CHANGE", "REMOVE"]),
  membersOnly: z.boolean(),
  gameOption: z.string(),
}).superRefine((values, context) => {
  const gameType = gameTypes.find((type) => type.code === values.gameType);
  if (!gameType?.available) context.addIssue({ code: "custom", path: ["gameType"], message: "아직 준비 중인 게임입니다." });
  else if (values.seatCount < gameType.minSeats || values.seatCount > gameType.maxSeats) {
    context.addIssue({ code: "custom", path: ["seatCount"], message: "이 게임에서 고를 수 없는 인원 수입니다." });
  }
  if (gameType && values.gameOption !== "" && !gameType.options.some((option) => option.code === values.gameOption)) {
    context.addIssue({ code: "custom", path: ["gameOption"], message: "이 게임에서 고를 수 없는 옵션입니다." });
  }
  if (values.passwordMode !== "CHANGE") return;
  if (requireNewPassword && values.password.length === 0) {
    context.addIssue({ code: "custom", path: ["password"], message: "새 비밀번호를 입력해 주세요." });
  } else if (values.password.length > 0 && values.password.length < 4) {
    context.addIssue({ code: "custom", path: ["password"], message: "비밀번호는 4~20자로 입력해 주세요." });
  }
});

interface OnlineRoomFormProperties {
  mode: "create" | "edit";
  gameTypes: OnlineGameTypeInfo[];
  defaultValues: OnlineRoomFormValues;
  /** 수정 모드: 지금 방에 비밀번호가 있는지 */
  hasPassword?: boolean;
  /** 로그인 회원만 '로그인 유저만 참가'를 켤 수 있다 */
  canUseMembersOnly: boolean;
  /** 게임 중에는 게임 종류·인원을 바꿀 수 없다 */
  gameLocked?: boolean;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: OnlineRoomFormValues) => void;
  onCancel?: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const OnlineRoomForm = ({
  mode, gameTypes, defaultValues, hasPassword = false, canUseMembersOnly, gameLocked = false, submitting = false, submitLabel, onSubmit, onCancel,
}: OnlineRoomFormProperties) => {
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<OnlineRoomFormValues>({
    resolver: zodResolver(createRoomFormSchema(gameTypes, mode === "edit" && hasPassword)),
    defaultValues,
  });
  const selectedType = gameTypes.find((type) => type.code === watch("gameType"));
  const passwordMode = watch("passwordMode");
  const seatOptions = selectedType ? Array.from({ length: selectedType.maxSeats - selectedType.minSeats + 1 }, (_, index) => selectedType.minSeats + index) : [];
  const showPasswordInput = mode === "create" || !hasPassword || passwordMode === "CHANGE";
  // 칸과 오류 문구를 이어 주는 id. 오류 문구를 label 안에 넣으면 칸 이름이 "방 제목 방 제목을 입력해 주세요"처럼 길어지므로
  // label 밖에 두고 aria-describedby로 "이 칸의 설명"으로 연결한다(화면 낭독기가 칸 이름 뒤에 읽어 준다).
  const fieldId = useId();
  const ids = { title: `${fieldId}-title`, gameType: `${fieldId}-game`, seatCount: `${fieldId}-seats`, gameOption: `${fieldId}-option`, password: `${fieldId}-password` };
  const gameOptions = selectedType?.options ?? [];
  const errorId = (name: keyof typeof ids) => `${ids[name]}-error`;

  return (
    <form className="online-room-form" onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <div className="online-field">
        <label htmlFor={ids.title}>방 제목</label>
        <input id={ids.title} {...register("title")} maxLength={30} placeholder="예) 오목 한 판 해요"
          aria-invalid={errors.title ? true : undefined} aria-describedby={errors.title ? errorId("title") : undefined} />
        {errors.title ? <small id={errorId("title")} className="field-error">{errors.title.message}</small> : null}
      </div>

      <div className="online-room-form-row">
        <div className="online-field">
          <label htmlFor={ids.gameType}>게임</label>
          <select
            id={ids.gameType}
            aria-describedby={errors.gameType ? errorId("gameType") : undefined}
            {...register("gameType", {
              // 게임을 바꾸면 인원 수를 새 게임 범위 안으로 맞추고 옵션은 새 게임의 처음 값으로 되돌린다
              // (이벤트 처리 함수에서 바로 — Effect가 필요 없다. 서버도 게임이 바뀌면 같은 규칙을 쓴다)
              onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                const nextType = gameTypes.find((type) => type.code === event.target.value);
                if (!nextType) return;
                setValue("seatCount", clamp(getValues("seatCount"), nextType.minSeats, nextType.maxSeats));
                setValue("gameOption", nextType.defaultOption ?? "");
              },
            })}
            disabled={gameLocked}
          >
            {gameTypes.map((type) => (
              <option key={type.code} value={type.code} disabled={!type.available}>
                {type.label}{type.available ? "" : " (준비 중)"}
              </option>
            ))}
          </select>
          {errors.gameType ? <small id={errorId("gameType")} className="field-error">{errors.gameType.message}</small> : null}
        </div>
        <div className="online-field">
          <label htmlFor={ids.seatCount}>플레이어 수</label>
          <select id={ids.seatCount} {...register("seatCount", { valueAsNumber: true })} disabled={gameLocked || seatOptions.length <= 1}
            aria-describedby={errors.seatCount ? errorId("seatCount") : undefined}>
            {seatOptions.map((count) => <option key={count} value={count}>{count}명</option>)}
          </select>
          {errors.seatCount ? <small id={errorId("seatCount")} className="field-error">{errors.seatCount.message}</small> : null}
        </div>
      </div>
      {gameOptions.length > 0 ? (
        <div className="online-field">
          <label htmlFor={ids.gameOption}>게임 옵션</label>
          <select id={ids.gameOption} {...register("gameOption")} disabled={gameLocked}
            aria-describedby={errors.gameOption ? errorId("gameOption") : undefined}>
            {gameOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
          </select>
          {errors.gameOption ? <small id={errorId("gameOption")} className="field-error">{errors.gameOption.message}</small> : null}
        </div>
      ) : null}
      {gameLocked ? <p className="online-form-hint">게임 중에는 게임 종류·인원 수·옵션을 바꿀 수 없습니다.</p> : null}

      {mode === "edit" && hasPassword ? (
        <fieldset className="online-password-mode">
          <legend>비밀번호</legend>
          <label><input type="radio" value="KEEP" {...register("passwordMode")} /> 그대로</label>
          <label><input type="radio" value="CHANGE" {...register("passwordMode")} /> 바꾸기</label>
          <label><input type="radio" value="REMOVE" {...register("passwordMode")} /> 해제</label>
        </fieldset>
      ) : null}
      {showPasswordInput ? (
        <div className="online-field">
          <label htmlFor={ids.password}>{mode === "edit" && hasPassword ? "새 비밀번호" : "비밀번호 (선택, 4~20자)"}</label>
          <input id={ids.password} type="password" autoComplete="new-password" maxLength={20} {...register("password")} placeholder="비워 두면 누구나 들어올 수 있습니다"
            aria-invalid={errors.password ? true : undefined} aria-describedby={errors.password ? errorId("password") : undefined} />
          {errors.password ? <small id={errorId("password")} className="field-error">{errors.password.message}</small> : null}
        </div>
      ) : null}

      <label className="online-checkbox">
        <input type="checkbox" {...register("membersOnly")} disabled={!canUseMembersOnly} />
        <span>로그인 유저만 참가</span>
      </label>
      {!canUseMembersOnly ? <p className="online-form-hint">로그인하면 '로그인 유저만 참가'를 켤 수 있습니다.</p> : null}

      <div className="button-row">
        <button type="submit" disabled={submitting}>{submitting ? "처리 중..." : submitLabel}</button>
        {onCancel ? <button type="button" className="ghost-button" onClick={onCancel}>취소</button> : null}
      </div>
    </form>
  );
};
