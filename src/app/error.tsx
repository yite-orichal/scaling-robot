"use client";

import { Button, Link } from "@nextui-org/react";
import { BiSolidError } from "react-icons/bi";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 items-center justify-center h-screen">
      <div>
        <BiSolidError className="w-16 h-16 text-danger" />
      </div>
      <div className="text-2xl font-bold">Oops !!!</div>
      <div className="text-lg">Something error happend!</div>
      <div className="text-lg">Or your project file has broken</div>
      <Button color="primary" as={Link} href="/">
        Back to Home
      </Button>
    </div>
  );
}
