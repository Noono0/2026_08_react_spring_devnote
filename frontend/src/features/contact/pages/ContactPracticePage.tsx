import { useEffect, useMemo, useReducer, useState } from "react";
import { applicationNotification } from "@/shared/notification/applicationNotification";

interface ContactItem {
  contactId: number;
  contactName: string;
  emailAddress: string;
  phoneNumber: string;
}

type ContactAction =
  | { type: "CREATE"; contactItem: ContactItem }
  | { type: "UPDATE"; contactItem: ContactItem }
  | { type: "DELETE"; contactId: number }
  | { type: "RESET"; contactItems: ContactItem[] };

const CONTACT_STORAGE_KEY = "practiceContacts";
const initialContacts: ContactItem[] = [
  { contactId: 1, contactName: "김리액트", emailAddress: "react@example.com", phoneNumber: "010-1111-2222" },
  { contactId: 2, contactName: "박스프링", emailAddress: "spring@example.com", phoneNumber: "010-3333-4444" },
];

const contactReducer = (contactItems: ContactItem[], contactAction: ContactAction): ContactItem[] => {
  console.log("[contactReducer] Action 처리", { contactAction, previousContactItems: contactItems });
  switch (contactAction.type) {
    case "CREATE":
      return [...contactItems, contactAction.contactItem];
    case "UPDATE":
      return contactItems.map((contactItem) => (
        contactItem.contactId === contactAction.contactItem.contactId
          ? contactAction.contactItem
          : contactItem
      ));
    case "DELETE":
      return contactItems.filter((contactItem) => contactItem.contactId !== contactAction.contactId);
    case "RESET":
      return contactAction.contactItems;
    default:
      return contactItems;
  }
};

const loadStoredContacts = (): ContactItem[] => {
  const storedContacts = localStorage.getItem(CONTACT_STORAGE_KEY);
  if (!storedContacts) return initialContacts;
  try {
    return JSON.parse(storedContacts) as ContactItem[];
  } catch {
    return initialContacts;
  }
};

export const ContactPracticePage = () => {
  const [contactItems, dispatchContactAction] = useReducer(contactReducer, undefined, loadStoredContacts);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contactItems));
    console.log("[ContactPracticePage] localStorage 저장", { contactCount: contactItems.length });
  }, [contactItems]);

  const filteredContactItems = useMemo(() => {
    const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
    return contactItems.filter((contactItem) => (
      contactItem.contactName.toLowerCase().includes(normalizedSearchKeyword)
      || contactItem.emailAddress.toLowerCase().includes(normalizedSearchKeyword)
    ));
  }, [contactItems, searchKeyword]);

  const clearForm = (): void => {
    setEditingContactId(null);
    setContactName("");
    setEmailAddress("");
    setPhoneNumber("");
  };

  const saveContact = (): void => {
    if (!contactName.trim() || !emailAddress.trim()) {
      applicationNotification.warning("이름과 이메일을 입력해 주세요.");
      return;
    }

    const contactItem: ContactItem = {
      contactId: editingContactId ?? Date.now(),
      contactName: contactName.trim(),
      emailAddress: emailAddress.trim(),
      phoneNumber: phoneNumber.trim(),
    };
    dispatchContactAction({ type: editingContactId ? "UPDATE" : "CREATE", contactItem });
    applicationNotification.success(editingContactId ? "연락처를 수정했습니다." : "연락처를 등록했습니다.");
    clearForm();
  };

  return (
    <section>
      <div className="page-heading-row">
        <div>
          <span className="level-badge level-초급">초급+</span>
          <h1>연락처 Reducer CRUD</h1>
          <p>여러 상태 변경 규칙을 Reducer에 모으고 새로고침 후에도 localStorage에서 복원합니다.</p>
        </div>
      </div>

      <div className="split-practice-layout">
        <article className="practice-card sticky-form-card">
          <h2>{editingContactId ? "연락처 수정" : "연락처 등록"}</h2>
          <label>이름<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label>이메일<input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} /></label>
          <label>전화번호<input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></label>
          <div className="button-row">
            <button type="button" onClick={saveContact}>{editingContactId ? "수정 저장" : "등록"}</button>
            {editingContactId ? <button type="button" className="ghost-button" onClick={clearForm}>취소</button> : null}
          </div>
        </article>

        <div>
          <label className="search-field">
            연락처 검색
            <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="이름 또는 이메일" />
          </label>
          <div className="contact-card-grid">
            {filteredContactItems.map((contactItem) => (
              <article className="contact-card" key={contactItem.contactId}>
                <div className="avatar-circle">{contactItem.contactName.slice(0, 1)}</div>
                <div className="contact-card-content">
                  <strong>{contactItem.contactName}</strong>
                  <span>{contactItem.emailAddress}</span>
                  <span>{contactItem.phoneNumber || "전화번호 없음"}</span>
                </div>
                <div className="button-row compact-button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingContactId(contactItem.contactId);
                      setContactName(contactItem.contactName);
                      setEmailAddress(contactItem.emailAddress);
                      setPhoneNumber(contactItem.phoneNumber);
                    }}
                  >수정</button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => dispatchContactAction({ type: "DELETE", contactId: contactItem.contactId })}
                  >삭제</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
