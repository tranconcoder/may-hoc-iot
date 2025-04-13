import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import AddUser from "../../components/AddUser";
import { OutletPassType } from "../../components/layouts/BoxLayout";

export default function AddUserPage() {
    const [setTitle, setButtonProps] = useOutletContext<OutletPassType>();

    useEffect(() => {
        setTitle("Thêm người dùng");
        setButtonProps({
            children: "Trở lại",
            redirect: "/",
        });
    }, []); // eslint-disable-line

    return <AddUser />;
}
