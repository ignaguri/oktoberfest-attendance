import BugReportLink from "@/components/BugReportLink";
import { Separator } from "@/components/ui/separator";
import { Heart, Beer } from "lucide-react";
import { Link } from "next-view-transitions";

const Footer = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  return (
    <footer className="flex flex-col items-center mx-2">
      <Separator className="my-4" decorative />
      <div className="text-sm text-gray-500 text-center flex items-center gap-1 flex-wrap">
        Made with <Heart className="inline" size={16} /> by{" "}
        <Link
          href="https://github.com/ignaguri"
          target="_blank"
          className="underline"
        >
          @ignaguri
        </Link>
        {isLoggedIn && (
          <>
            <span>{" · "}</span>
            <Link
              href="https://www.paypal.me/ignacioguri"
              target="_blank"
              className="underline flex items-center gap-0.5"
            >
              <span>Buy me a</span>
              <Beer size={16} />
            </Link>
          </>
        )}
        <span>{" · "}</span>
        <BugReportLink className="text-sm text-gray-500 font-normal	underline" />
      </div>
    </footer>
  );
};

export default Footer;
